import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  completeUpload,
  deleteAttachment,
  listAttachments,
  putFile,
  requestUpload,
} from '@/api/attachments';
import type { BoardContent } from '@/api/types';
import { patchCard } from '@/lib/board-cache';
import { activityKeys } from './use-activity';
import { boardKeys } from './use-boards';
import { cardKeys } from './use-cards';

export const attachmentKeys = {
  /** Under the card's key, so refreshing the card refreshes its files too. */
  card: (cardId: string) => [...cardKeys.detail(cardId), 'attachments'] as const,
};

/** GET /cards/:id/attachments. Image preview links last 10 minutes, so refetch before then. */
export function useAttachments(cardId: string) {
  return useQuery({
    queryKey: attachmentKeys.card(cardId),
    queryFn: () => listAttachments(cardId),
    staleTime: 5 * 60_000,
    refetchInterval: 8 * 60_000,
  });
}

export type PickedFile = { uri: string; name: string; mimeType: string };

/**
 * The three upload steps (ask for a link, PUT the bytes with progress, confirm), then refresh
 * the card's files, its timeline and the paperclip count on the board.
 */
export function useUploadAttachment(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async (file: PickedFile) => {
      setProgress(0);
      // Read the file once: its real size is what the API checks against.
      const blob = await (await fetch(file.uri)).blob();
      const { attachmentId, upload } = await requestUpload(cardId, {
        fileName: file.name,
        mimeType: file.mimeType,
        size: blob.size,
      });
      await putFile(upload, blob, setProgress);
      return completeUpload(attachmentId);
    },
    onSuccess: () => {
      queryClient.setQueryData<BoardContent>(boardKeys.content(boardId), (old) =>
        old
          ? patchCard(old, cardId, (card) => ({ attachmentCount: (card.attachmentCount ?? 0) + 1 }))
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.card(cardId) });
      void queryClient.invalidateQueries({ queryKey: activityKeys.card(cardId) });
    },
    onSettled: () => setProgress(null),
  });
  return { ...mutation, progress };
}

export function useDeleteAttachment(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(attachmentId),
    onSuccess: () => {
      queryClient.setQueryData<BoardContent>(boardKeys.content(boardId), (old) =>
        old
          ? patchCard(old, cardId, (card) => ({
              attachmentCount: Math.max(0, (card.attachmentCount ?? 0) - 1),
            }))
          : old,
      );
      void queryClient.invalidateQueries({ queryKey: attachmentKeys.card(cardId) });
      void queryClient.invalidateQueries({ queryKey: activityKeys.card(cardId) });
    },
  });
}
