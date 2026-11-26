import NetInfo from '@react-native-community/netinfo';
import type { QueryKey } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

import { refreshSession } from '@/api/client';
import { queryClient } from '@/api/query-client';
import type { Board } from '@/api/types';
import { activityKeys } from '@/hooks/use-activity';
import { boardKeys } from '@/hooks/use-boards';
import { cardKeys } from '@/hooks/use-cards';
import { meQueryKey } from '@/hooks/use-me';
import { useSession } from '@/store/session';

/**
 * Live board updates over Socket.IO (protocol: CLAUDE.md → "Realtime").
 *
 * - One socket while logged in. It sends the current access token when it connects; if the
 *   server refuses it (or the token expires while connected), the token is refreshed through
 *   the same shared refresh as HTTP, and the socket connects again.
 * - Screens call useBoardRoom(boardId). Rooms are counted, because Board and Card detail are
 *   open at the same time for the same board, and joined again after every reconnect.
 * - A `board:event` from someone else refetches what it touched (the board content, the card,
 *   labels…). Events grouped within 150 ms cause one refetch. Our own events are ignored:
 *   they're already applied optimistically.
 * - `board:access-removed` refetches the board, which now returns 404, so the screens show
 *   31 · Access removed (the same path as an HTTP 404).
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting';

type BoardEvent = {
  type: string;
  boardId: string;
  actorId: string;
  data: { cardId?: string } & Record<string, unknown>;
};

export const useRealtime = create<{
  status: RealtimeStatus;
  online: boolean;
  /** True once the connection has been down for a while (not for a short blip). */
  showReconnecting: boolean;
}>(() => ({ status: 'idle', online: true, showReconnecting: false }));

// Don't flash "Reconnecting…" for a blip: only show it if it lasts this long.
const RECONNECT_GRACE_MS = 2000;
let graceTimer: ReturnType<typeof setTimeout> | null = null;

function setStatus(status: RealtimeStatus) {
  useRealtime.setState({ status });
  if (status === 'reconnecting') {
    graceTimer ??= setTimeout(
      () => useRealtime.setState({ showReconnecting: true }),
      RECONNECT_GRACE_MS,
    );
  } else {
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = null;
    useRealtime.setState({ showReconnecting: false });
  }
}

// The socket lives at the server root, not under /api/v1.
const SERVER_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/api\/v1\/?$/, '');

let socket: Socket | null = null;
/** The access token the socket last connected with. */
let tokenUsed: string | null = null;
/** boardId → how many open screens want its events. */
const joined = new Map<string, number>();
let hasConnectedBefore = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1000;

const signedIn = () => useSession.getState().status === 'signedIn';

function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    autoConnect: false,
    transports: ['websocket'],
    // A function, so every (re)connect sends the token we have at that moment.
    auth: (send) => {
      tokenUsed = useSession.getState().accessToken;
      send({ token: tokenUsed });
    },
  });

  socket.on('connect', () => {
    retryDelay = 1000;
    setStatus('connected');
    for (const boardId of joined.keys()) emitJoin(boardId);
    // Events sent while we were away are lost: catch up by refetching.
    if (hasConnectedBefore) for (const boardId of joined.keys()) refreshBoard(boardId);
    hasConnectedBefore = true;
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io client disconnect') return setStatus('idle'); // we did it (logout)
    setStatus('reconnecting');
    // The server closed it (token expired): Socket.IO won't retry this one by itself.
    if (reason === 'io server disconnect') void reconnectWithFreshToken();
  });

  socket.on('connect_error', (error) => {
    setStatus(hasConnectedBefore ? 'reconnecting' : 'connecting');
    if (socket?.active) return; // network trouble: Socket.IO keeps retrying on its own
    if (error.message === 'unauthorized') void reconnectWithFreshToken();
    else retryLater();
  });

  socket.on('board:event', onBoardEvent);
  socket.on('board:access-removed', ({ boardId }: { boardId: string }) => {
    void queryClient.invalidateQueries({
      queryKey: boardKeys.content(boardId),
    });
    void queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
  });
  socket.on('auth:expired', () => setStatus('reconnecting'));

  return socket;
}

function connect() {
  if (!signedIn()) return;
  const s = getSocket();
  if (s.connected || s.active) return;
  setStatus(hasConnectedBefore ? 'reconnecting' : 'connecting');
  s.connect();
}

function disconnect() {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  hasConnectedBefore = false;
  socket?.disconnect();
  setStatus('idle');
}

/** Tries again later, waiting longer each time (1 s, 2 s, 4 s … up to 30 s). */
function retryLater(work: () => void = connect) {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    work();
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30_000);
}

async function reconnectWithFreshToken() {
  if (!signedIn()) return;
  const current = useSession.getState().accessToken;
  // If HTTP already refreshed since we connected, the new token is enough.
  if (!current || current === tokenUsed) {
    try {
      await refreshSession();
    } catch {
      // Logged out (the session listener disconnects us), or offline: try again later.
      if (signedIn()) retryLater(() => void reconnectWithFreshToken());
      return;
    }
  }
  // A token that's refused right after a refresh shouldn't loop: back off.
  retryLater();
}

// ---------- Rooms ----------

function emitJoin(boardId: string) {
  socket?.emit('board:join', { boardId }, (reply: { ok: boolean }) => {
    // No access any more: the refetch returns 404, and the screen shows Access removed.
    if (!reply?.ok)
      void queryClient.invalidateQueries({
        queryKey: boardKeys.content(boardId),
      });
  });
}

export function joinBoard(boardId: string) {
  const count = joined.get(boardId) ?? 0;
  joined.set(boardId, count + 1);
  if (count === 0 && socket?.connected) emitJoin(boardId);
}

export function leaveBoard(boardId: string) {
  const count = (joined.get(boardId) ?? 0) - 1;
  if (count > 0) return void joined.set(boardId, count);
  joined.delete(boardId);
  if (socket?.connected) socket.emit('board:leave', { boardId });
}

// ---------- Events → cache ----------

const pending = new Map<string, QueryKey>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function invalidateSoon(...keys: QueryKey[]) {
  for (const key of keys) pending.set(JSON.stringify(key), key);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 150);
}

function flush() {
  flushTimer = null;
  // While our own move is on its way, a refetch could briefly undo it on screen. Wait for it.
  const moving = queryClient.isMutating({
    predicate: (m) => m.options.scope?.id?.startsWith('move:') ?? false,
  });
  if (moving) {
    flushTimer = setTimeout(flush, 300);
    return;
  }
  const keys = [...pending.values()];
  pending.clear();
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

function refreshBoard(boardId: string) {
  invalidateSoon(boardKeys.content(boardId), boardKeys.labels(boardId), cardKeys.all);
}

function onBoardEvent(event: BoardEvent) {
  if (!joined.has(event.boardId)) return;

  // History and the archive aren't updated optimistically, so they refresh for every event,
  // our own included (the Activity row is written right after the event; the 150 ms wait
  // gives it time).
  const history: QueryKey[] = [activityKeys.board(event.boardId)];
  if (event.data?.cardId) history.push(activityKeys.card(event.data.cardId));
  if (event.type.endsWith('.archived')) history.push(activityKeys.archived(event.boardId));

  const me = queryClient.getQueryData<{ id: string }>(meQueryKey);
  if (me && event.actorId === me.id) return invalidateSoon(...history);

  const keys: QueryKey[] = [...history, boardKeys.content(event.boardId)];
  if (event.data?.cardId) keys.push(cardKeys.detail(event.data.cardId));
  if (event.type.startsWith('label.')) keys.push(boardKeys.labels(event.boardId));
  if (event.type === 'board.updated') {
    keys.push(boardKeys.detail(event.boardId));
    const workspaceId = queryClient.getQueryData<Board>(
      boardKeys.detail(event.boardId),
    )?.workspaceId;
    if (workspaceId) keys.push(boardKeys.lists(workspaceId));
  }
  if (event.type === 'board.member.changed' || event.type === 'workspace.member.changed') {
    keys.push(boardKeys.members(event.boardId));
  }
  invalidateSoon(...keys);
}

// ---------- Lifecycle ----------

let started = false;

/** Call once at app start. Connects while logged in, and follows the network and app state. */
export function startRealtime() {
  if (started) return;
  started = true;

  if (signedIn()) connect();
  useSession.subscribe((state, prev) => {
    if (state.status === 'signedIn' && prev.status !== 'signedIn') connect();
    if (state.status !== 'signedIn' && prev.status === 'signedIn') {
      joined.clear();
      disconnect();
    }
  });

  NetInfo.addEventListener((net) => {
    const online = net.isConnected !== false && net.isInternetReachable !== false;
    const wasOnline = useRealtime.getState().online;
    useRealtime.setState({ online });
    if (online && !wasOnline) {
      retryDelay = 1000;
      connect();
    }
  });

  // Coming back to the app: the OS may have paused the socket, and events may have been missed.
  AppState.addEventListener('change', (state) => {
    if (state !== 'active' || !signedIn()) return;
    connect();
    for (const boardId of joined.keys()) refreshBoard(boardId);
  });
}

/** "Retry" on the offline banner: check the network again and refetch the open boards. */
export async function retryNow() {
  await NetInfo.refresh();
  retryDelay = 1000;
  connect();
  for (const boardId of joined.keys()) refreshBoard(boardId);
}
