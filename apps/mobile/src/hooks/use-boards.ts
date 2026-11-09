import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { getBoard, listBoardMembers, listBoards } from '@/api/boards';
import type { Board } from '@/api/types';
import { workspaceKeys } from './use-workspaces';

/**
 * A workspace's board lists live under ['workspaces', id, 'boards'], so anything that
 * refreshes a workspace (role change, being removed) also refreshes its boards.
 * A single board lives under ['boards', id].
 */
export const boardKeys = {
  all: ['boards'] as const,
  detail: (id: string) => [...boardKeys.all, id] as const,
  members: (id: string) => [...boardKeys.all, id, 'members'] as const,
  /** Prefix for both the active and the archived list of one workspace. */
  lists: (workspaceId: string) => [...workspaceKeys.detail(workspaceId), 'boards'] as const,
  list: (workspaceId: string, archived: boolean) =>
    [...boardKeys.lists(workspaceId), archived ? 'archived' : 'active'] as const,
};

export function useBoards(workspaceId: string, archived = false) {
  return useQuery({
    queryKey: boardKeys.list(workspaceId, archived),
    queryFn: () => listBoards(workspaceId, archived),
  });
}

/** The board as last seen in any cached workspace board list (to show its name instantly). */
export function findCachedBoard(queryClient: QueryClient, id: string): Board | undefined {
  for (const [, boards] of queryClient.getQueriesData<Board[]>({ queryKey: workspaceKeys.all })) {
    if (!Array.isArray(boards)) continue;
    const match = boards.find((b) => b?.id === id && 'visibility' in b);
    if (match) return match;
  }
  return undefined;
}

/** GET /boards/:id — 404 means no access (show 31 · Access removed). */
export function useBoard(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: boardKeys.detail(id),
    queryFn: () => getBoard(id),
    placeholderData: () => findCachedBoard(queryClient, id),
  });
}

export function useBoardMembers(boardId: string, enabled = true) {
  return useQuery({
    queryKey: boardKeys.members(boardId),
    queryFn: () => listBoardMembers(boardId),
    enabled,
  });
}
