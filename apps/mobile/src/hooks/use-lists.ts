import { useMutation, useQueryClient } from '@tanstack/react-query';

import { archiveList, createList, renameList } from '@/api/lists';
import type { BoardContent, ListFields } from '@/api/types';
import { patchList } from '@/lib/board-cache';
import { boardKeys } from './use-boards';

function useContentCache(boardId: string) {
  const queryClient = useQueryClient();
  const key = boardKeys.content(boardId);
  return {
    update: (fn: (old: BoardContent) => BoardContent) =>
      queryClient.setQueryData<BoardContent>(key, (old) => (old ? fn(old) : old)),
    refetch: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}

const appendLists = (old: BoardContent, lists: ListFields[]): BoardContent => ({
  ...old,
  lists: [
    ...old.lists.filter((l) => !lists.some((n) => n.id === l.id)),
    ...lists.map((l) => ({ id: l.id, name: l.name, position: l.position, cards: [] })),
  ],
});

/**
 * POST /boards/:id/lists for one or more names, in order (29 · "start from a set" adds three).
 * Stops at the first failure; lists made before it stay.
 */
export function useCreateLists(boardId: string) {
  const cache = useContentCache(boardId);
  return useMutation({
    mutationFn: async (names: string[]) => {
      const made: ListFields[] = [];
      for (const name of names) {
        made.push(await createList(boardId, name));
        cache.update((old) => appendLists(old, made));
      }
      return made;
    },
    onSettled: () => cache.refetch(),
  });
}

/** PATCH /lists/:id */
export function useRenameList(boardId: string) {
  const cache = useContentCache(boardId);
  return useMutation({
    mutationFn: ({ listId, name }: { listId: string; name: string }) => renameList(listId, name),
    onSuccess: (list) =>
      cache.update((old) => patchList(old, list.id, (l) => ({ ...l, name: list.name }))),
    onError: () => void cache.refetch(),
  });
}

/** POST /lists/:id/archive — the list and its cards disappear from the board. */
export function useArchiveList(boardId: string) {
  const cache = useContentCache(boardId);
  return useMutation({
    mutationFn: (listId: string) => archiveList(listId),
    onSuccess: (list) => cache.update((old) => patchList(old, list.id, () => null)),
    onSettled: () => cache.refetch(),
  });
}
