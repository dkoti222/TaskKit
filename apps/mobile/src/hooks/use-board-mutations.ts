import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  archiveBoard,
  createBoard,
  removeBoardMember,
  restoreBoard,
  setBoardMemberRole,
  updateBoard,
  type BoardInput,
} from '@/api/boards';
import type { AssignableRole, Board, BoardMember } from '@/api/types';
import { boardKeys } from './use-boards';

/** POST /workspaces/:id/boards — refreshes that workspace's board grid. */
export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BoardInput) => createBoard(workspaceId, body),
    onSuccess: (board) => {
      // The board screen opens next; seed it so it doesn't flash a spinner.
      queryClient.setQueryData(boardKeys.detail(board.id), board);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) }),
  });
}

/**
 * Refreshes one board and its workspace's grids (active + archived). Runs after every change,
 * success or failure: a 403/404 usually means our access changed elsewhere, and re-reading the
 * board hides controls we can no longer use (or shows 31 · Access removed).
 */
function useRefreshBoard(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  return (boardId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) }),
      workspaceId
        ? queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) })
        : undefined,
    ]);
}

/** PATCH /boards/:id (board Owner, Admin). */
export function useUpdateBoard(boardId: string, workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = useRefreshBoard(workspaceId);
  return useMutation({
    mutationFn: (body: Partial<BoardInput>) => updateBoard(boardId, body),
    onSuccess: (updated) => {
      // The response has no `role`, so merge it into what we already have.
      queryClient.setQueryData<Board>(boardKeys.detail(boardId), (old) =>
        old ? { ...old, ...updated } : old,
      );
    },
    onSettled: () => refresh(boardId),
  });
}

/** POST /boards/:id/archive (board Owner, Admin). Takes the board id. */
export function useArchiveBoard(workspaceId: string | undefined) {
  const refresh = useRefreshBoard(workspaceId);
  return useMutation({
    mutationFn: (boardId: string) => archiveBoard(boardId),
    onSettled: (_data, _error, boardId) => refresh(boardId),
  });
}

/** POST /boards/:id/restore (board Owner, Admin). Takes the board id. */
export function useRestoreBoard(workspaceId: string) {
  const refresh = useRefreshBoard(workspaceId);
  return useMutation({
    mutationFn: (boardId: string) => restoreBoard(boardId),
    onSettled: (_data, _error, boardId) => refresh(boardId),
  });
}

/** PUT /boards/:id/members/:userId — role dropdown change, shown instantly and rolled back if refused. */
export function useSetBoardRole(boardId: string) {
  const queryClient = useQueryClient();
  const key = boardKeys.members(boardId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AssignableRole }) =>
      setBoardMemberRole(boardId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardMember[]>(key);
      queryClient.setQueryData<BoardMember[]>(key, (old) =>
        old?.map((m) => (m.userId === userId ? { ...m, role } : m)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId), exact: true }),
      ]),
  });
}

/** PUT for several people at once (Add people). Stops at the first failure. */
export function useAddBoardMembers(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userIds, role }: { userIds: string[]; role: AssignableRole }) => {
      for (const userId of userIds) await setBoardMemberRole(boardId, userId, role);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKeys.members(boardId) }),
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId), exact: true }),
      ]),
  });
}

/** DELETE /boards/:id/members/:userId */
export function useRemoveBoardMember(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeBoardMember(boardId, userId),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKeys.members(boardId) }),
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId), exact: true }),
      ]),
  });
}
