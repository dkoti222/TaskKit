import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getBoardContent, listLabels } from '@/api/boards';
import type { BoardContent } from '@/api/types';
import { byPosition } from '@/lib/board-cache';
import { boardKeys } from './use-boards';

/** Lists and cards are always kept sorted by position, so screens can render them as-is. */
function sortContent(content: BoardContent): BoardContent {
  return {
    ...content,
    lists: [...content.lists]
      .sort(byPosition)
      .map((list) => ({ ...list, cards: [...list.cards].sort(byPosition) })),
  };
}

/** GET /boards/:id/content. A 404 means no access (show 31 · Access removed). */
export function useBoardContent(boardId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: boardKeys.content(boardId),
    queryFn: async () => {
      const content = sortContent(await getBoardContent(boardId));
      // The response includes the board with your role: keep GET /boards/:id in step with it.
      queryClient.setQueryData(boardKeys.detail(boardId), content.board);
      return content;
    },
    enabled: !!boardId,
  });
}

/** GET /boards/:id/labels */
export function useLabels(boardId: string) {
  return useQuery({
    queryKey: boardKeys.labels(boardId),
    queryFn: () => listLabels(boardId),
    enabled: !!boardId,
  });
}

/** Refetch the board's lists and cards (after an error, or something we can't patch locally). */
export function useRefreshContent(boardId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: boardKeys.content(boardId) });
}
