import { useMutation, useQueryClient } from '@tanstack/react-query';

import { moveCard } from '@/api/cards';
import { moveList } from '@/api/lists';
import type { BoardContent, CardDetail } from '@/api/types';
import { findCard, moveCardLocal, moveListLocal, patchCard } from '@/lib/board-cache';
import { boardKeys } from './use-boards';
import { cardKeys } from './use-cards';

export type MoveCardVars = { cardId: string; listId: string; index: number; version: number };

/**
 * PATCH /cards/:id/move with an optimistic update:
 * 1. the card jumps to its new place in the cached board straight away,
 * 2. the API gets { listId, index, version },
 * 3. on success the card takes the version (and position) from the response,
 * 4. on 409 or any other error the cache is rolled back and the board refetched.
 * The caller shows the error message (mutate's onError, or mutation.error).
 *
 * Moves on one board run one at a time (`scope`), and each reads the card's version just
 * before sending, so two quick moves of the same card don't conflict with each other.
 */
export function useMoveCard(boardId: string) {
  const queryClient = useQueryClient();
  const key = boardKeys.content(boardId);

  return useMutation({
    scope: { id: `move:${boardId}` },
    mutationFn: ({ cardId, listId, index, version }: MoveCardVars) => {
      const latest = findCard(queryClient.getQueryData<BoardContent>(key), cardId)?.card.version;
      return moveCard(cardId, { listId, index, version: latest ?? version });
    },
    onMutate: async ({ cardId, listId, index }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardContent>(key);
      const result = previous ? moveCardLocal(previous, cardId, listId, index) : null;
      if (result) queryClient.setQueryData(key, result.content);
      return { previous, position: result?.position };
    },
    onSuccess: (moved, _vars, context) => {
      queryClient.setQueryData<BoardContent>(key, (old) =>
        old ? patchCard(old, moved.id, { version: moved.version, position: moved.position }) : old,
      );
      // The API renumbered the list (neighbours were too close): our other positions are stale.
      if (context?.position !== moved.position)
        void queryClient.invalidateQueries({ queryKey: key });

      const content = queryClient.getQueryData<BoardContent>(key);
      const list = content?.lists.find((l) => l.id === moved.listId);
      queryClient.setQueryData<CardDetail>(cardKeys.detail(moved.id), (old) =>
        old
          ? {
              ...old,
              listId: moved.listId,
              position: moved.position,
              version: moved.version,
              list: list ? { ...old.list, id: list.id, name: list.name } : old.list,
            }
          : old,
      );
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** PATCH /lists/:id/move — same optimistic pattern as cards (lists have no version). */
export function useMoveList(boardId: string) {
  const queryClient = useQueryClient();
  const key = boardKeys.content(boardId);

  return useMutation({
    scope: { id: `move:${boardId}` },
    mutationFn: ({ listId, index }: { listId: string; index: number }) => moveList(listId, index),
    onMutate: async ({ listId, index }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardContent>(key);
      const result = previous ? moveListLocal(previous, listId, index) : null;
      if (result) queryClient.setQueryData(key, result.content);
      return { previous, position: result?.position };
    },
    onSuccess: (moved, _vars, context) => {
      queryClient.setQueryData<BoardContent>(key, (old) =>
        old
          ? {
              ...old,
              lists: old.lists.map((l) =>
                l.id === moved.id ? { ...l, position: moved.position } : l,
              ),
            }
          : old,
      );
      if (context?.position !== moved.position)
        void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
