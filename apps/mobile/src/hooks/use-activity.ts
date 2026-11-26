import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import {
  createComment,
  deleteComment,
  getArchived,
  listBoardActivity,
  listCardActivity,
  restoreCard,
  restoreList,
  updateComment,
} from '@/api/activity';
import type { ActivityItem, ActivityKind, BoardContent, Comment, Page } from '@/api/types';
import { patchCard } from '@/lib/board-cache';
import { boardKeys } from './use-boards';
import { cardKeys } from './use-cards';

export const activityKeys = {
  /** Under the card's key, so refreshing the card refreshes its timeline too. */
  card: (cardId: string) => [...cardKeys.detail(cardId), 'activity'] as const,
  /** All kinds of one board's activity (prefix). */
  board: (boardId: string) => [...boardKeys.detail(boardId), 'activity'] as const,
  boardKind: (boardId: string, kind: ActivityKind) =>
    [...activityKeys.board(boardId), kind] as const,
  archived: (boardId: string) => [...boardKeys.detail(boardId), 'archived'] as const,
};

type Pages = InfiniteData<Page<ActivityItem>, string | null>;

/** GET /cards/:id/activity, page by page (newest first). */
export function useCardActivity(cardId: string) {
  return useInfiniteQuery({
    queryKey: activityKeys.card(cardId),
    queryFn: ({ pageParam }) => listCardActivity(cardId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!cardId,
  });
}

/** GET /boards/:id/activity?kind=…, page by page (newest first). Always fresh on open. */
export function useBoardActivity(boardId: string, kind: ActivityKind) {
  return useInfiniteQuery({
    queryKey: activityKeys.boardKind(boardId, kind),
    queryFn: ({ pageParam }) => listBoardActivity(boardId, kind, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    refetchOnMount: 'always',
    enabled: !!boardId,
  });
}

/** GET /boards/:id/archived */
export function useArchived(boardId: string) {
  return useQuery({
    queryKey: activityKeys.archived(boardId),
    queryFn: () => getArchived(boardId),
    enabled: !!boardId,
  });
}

// ---------- Comments ----------

/** Replaces one comment wherever it appears in the card's timeline pages. */
function patchComment(queryClient: QueryClient, cardId: string, comment: Comment) {
  queryClient.setQueryData<Pages>(activityKeys.card(cardId), (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.comment?.id === comment.id ? { ...item, comment } : item,
            ),
          })),
        }
      : old,
  );
}

function bumpCommentCount(queryClient: QueryClient, boardId: string, cardId: string, by: number) {
  queryClient.setQueryData<BoardContent>(boardKeys.content(boardId), (old) =>
    old
      ? patchCard(old, cardId, (card) => ({
          commentCount: Math.max(0, (card.commentCount ?? 0) + by),
        }))
      : old,
  );
}

/** POST /cards/:id/comments. The new comment appears when the timeline refetches. */
export function useAddComment(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(cardId, body),
    onSuccess: () => {
      bumpCommentCount(queryClient, boardId, cardId, 1);
      return queryClient.invalidateQueries({ queryKey: activityKeys.card(cardId) });
    },
  });
}

/** PATCH /comments/:id (your own only). */
export function useEditComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      updateComment(commentId, body),
    onSuccess: (comment) => patchComment(queryClient, cardId, comment),
  });
}

/** DELETE /comments/:id. The timeline then shows "Comment deleted". */
export function useDeleteComment(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (comment: Comment) => deleteComment(comment.id),
    onSuccess: (_, comment) => {
      patchComment(queryClient, cardId, { ...comment, deleted: true, body: '', mentions: [] });
      bumpCommentCount(queryClient, boardId, cardId, -1);
    },
  });
}

// ---------- Restore (18) ----------

/** POST /lists/:id/restore or /cards/:id/restore, then refresh the board and the archive. */
export function useRestore(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, id }: { kind: 'list' | 'card'; id: string }) =>
      kind === 'list' ? restoreList(id) : restoreCard(id),
    onSuccess: (_, { kind, id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: activityKeys.archived(boardId) }),
        queryClient.invalidateQueries({ queryKey: boardKeys.content(boardId) }),
        kind === 'card'
          ? queryClient.invalidateQueries({ queryKey: cardKeys.detail(id) })
          : Promise.resolve(),
      ]),
  });
}
