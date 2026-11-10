import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { createLabel } from '@/api/boards';
import {
  addAssignee,
  addCardLabel,
  addChecklistItem,
  archiveCard,
  createCard,
  deleteChecklistItem,
  getCard,
  removeAssignee,
  removeCardLabel,
  updateCard,
  updateChecklistItem,
  type CardUpdate,
  type NewCardInput,
} from '@/api/cards';
import type {
  BoardContent,
  CardDetail,
  CardPerson,
  CardSummary,
  ChecklistItem,
  Label,
} from '@/api/types';
import { getErrorMessage } from '@/api/errors';
import { patchCard, patchList, removeCard } from '@/lib/board-cache';
import { boardKeys } from './use-boards';

export const cardKeys = {
  all: ['cards'] as const,
  detail: (id: string) => [...cardKeys.all, id] as const,
};

/** GET /cards/:id */
export function useCard(cardId: string) {
  return useQuery({ queryKey: cardKeys.detail(cardId), queryFn: () => getCard(cardId) });
}

// ---------- Cache helpers ----------

/**
 * Every card change updates two caches: the card detail (15) and the card's face on the board
 * (13). These helpers edit both, and can snapshot/restore them for optimistic updates.
 */
function cardCache(queryClient: QueryClient, cardId: string, boardId: string) {
  const detailKey = cardKeys.detail(cardId);
  const contentKey = boardKeys.content(boardId);
  return {
    async cancel() {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: detailKey }),
        queryClient.cancelQueries({ queryKey: contentKey }),
      ]);
    },
    snapshot() {
      return {
        detail: queryClient.getQueryData<CardDetail>(detailKey),
        content: queryClient.getQueryData<BoardContent>(contentKey),
      };
    },
    restore(snap: { detail?: CardDetail; content?: BoardContent } | undefined) {
      if (snap?.detail) queryClient.setQueryData(detailKey, snap.detail);
      if (snap?.content) queryClient.setQueryData(contentKey, snap.content);
    },
    detail(fn: (old: CardDetail) => CardDetail) {
      queryClient.setQueryData<CardDetail>(detailKey, (old) => (old ? fn(old) : old));
    },
    summary(fn: (old: CardSummary) => Partial<CardSummary>) {
      queryClient.setQueryData<BoardContent>(contentKey, (old) =>
        old ? patchCard(old, cardId, fn) : old,
      );
    },
    refetch() {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({ queryKey: contentKey }),
      ]);
    },
  };
}

const checklistCount = (items: ChecklistItem[]) => ({
  total: items.length,
  done: items.filter((i) => i.done).length,
});

// ---------- Create ----------

export type NewCardVars = {
  listId: string;
  input: NewCardInput;
  assignees: CardPerson[];
  labels: Label[];
};

/**
 * POST /lists/:id/cards, then one PUT per assignee and label picked on 16 · New card.
 * If the card was created but an assignee/label failed, it still succeeds (so a retry doesn't
 * make a second card) and returns `extrasError`.
 */
export function useCreateCard(boardId: string) {
  const queryClient = useQueryClient();
  const contentKey = boardKeys.content(boardId);
  return useMutation({
    mutationFn: async ({ listId, input, assignees, labels }: NewCardVars) => {
      const card = await createCard(listId, input);
      let version = card.version;
      let savedAssignees: CardPerson[] = [];
      let savedLabels: Label[] = [];
      let extrasError: string | null = null;
      try {
        for (const person of assignees) {
          savedAssignees = await addAssignee(card.id, person.id);
          version += 1;
        }
        for (const label of labels) {
          savedLabels = await addCardLabel(card.id, label.id);
          version += 1;
        }
      } catch (error) {
        extrasError = `Card added, but not all people and labels were saved. ${getErrorMessage(error)}`;
      }
      return {
        card: { ...card, version },
        assignees: savedAssignees,
        labels: savedLabels,
        extrasError,
      };
    },
    onSuccess: ({ card, assignees, labels }) => {
      const summary: CardSummary = {
        id: card.id,
        title: card.title,
        dueAt: card.dueAt,
        position: card.position,
        version: card.version,
        assignees,
        labels,
        checklist: { total: 0, done: 0 },
      };
      queryClient.setQueryData<BoardContent>(contentKey, (old) =>
        old
          ? patchList(old, card.listId, (list) => ({ ...list, cards: [...list.cards, summary] }))
          : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contentKey }),
  });
}

// ---------- Fields and archive ----------

/** PATCH /cards/:id (title, description, due date). */
export function useUpdateCard(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  return useMutation({
    mutationFn: (body: CardUpdate) => updateCard(cardId, body),
    onSuccess: (card) => {
      const fields = {
        title: card.title,
        description: card.description,
        dueAt: card.dueAt,
        version: card.version,
        updatedAt: card.updatedAt,
      };
      cache.detail((old) => ({ ...old, ...fields }));
      cache.summary(() => ({ title: card.title, dueAt: card.dueAt, version: card.version }));
    },
    onError: () => void cache.refetch(),
  });
}

/** POST /cards/:id/archive — removes the card from the board. */
export function useArchiveCard(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const contentKey = boardKeys.content(boardId);
  return useMutation({
    mutationFn: () => archiveCard(cardId),
    onSuccess: (card) => {
      queryClient.setQueryData<BoardContent>(contentKey, (old) =>
        old ? removeCard(old, cardId) : old,
      );
      queryClient.setQueryData<CardDetail>(cardKeys.detail(cardId), (old) =>
        old ? { ...old, archivedAt: card.archivedAt, version: card.version } : old,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: contentKey }),
  });
}

// ---------- Assignees and labels (optimistic toggles) ----------

/** PUT or DELETE /cards/:id/assignees/:userId. Each change bumps the card's version by one. */
export function useToggleAssignee(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  return useMutation({
    mutationFn: ({ person, on }: { person: CardPerson; on: boolean }) =>
      on ? addAssignee(cardId, person.id) : removeAssignee(cardId, person.id),
    onMutate: async ({ person, on }) => {
      await cache.cancel();
      const snap = cache.snapshot();
      const apply = (list: CardPerson[]) =>
        on
          ? [...list.filter((p) => p.id !== person.id), person]
          : list.filter((p) => p.id !== person.id);
      cache.detail((old) => ({ ...old, assignees: apply(old.assignees) }));
      cache.summary((old) => ({ assignees: apply(old.assignees) }));
      return snap;
    },
    onSuccess: (assignees) => {
      cache.detail((old) => ({ ...old, assignees, version: old.version + 1 }));
      cache.summary((old) => ({ assignees, version: old.version + 1 }));
    },
    onError: (_e, _v, snap) => {
      cache.restore(snap);
      void cache.refetch();
    },
  });
}

/** PUT or DELETE /cards/:id/labels/:labelId. Each change bumps the card's version by one. */
export function useToggleCardLabel(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  return useMutation({
    mutationFn: ({ label, on }: { label: Label; on: boolean }) =>
      on ? addCardLabel(cardId, label.id) : removeCardLabel(cardId, label.id),
    onMutate: async ({ label, on }) => {
      await cache.cancel();
      const snap = cache.snapshot();
      const apply = (list: Label[]) =>
        on
          ? [...list.filter((l) => l.id !== label.id), label]
          : list.filter((l) => l.id !== label.id);
      cache.detail((old) => ({ ...old, labels: apply(old.labels) }));
      cache.summary((old) => ({ labels: apply(old.labels) }));
      return snap;
    },
    onSuccess: (labels) => {
      cache.detail((old) => ({ ...old, labels, version: old.version + 1 }));
      cache.summary((old) => ({ labels, version: old.version + 1 }));
    },
    onError: (_e, _v, snap) => {
      cache.restore(snap);
      void cache.refetch();
    },
  });
}

/** POST /boards/:id/labels (board Owner, Admin). */
export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color: string }) => createLabel(boardId, body),
    onSuccess: (label) => {
      queryClient.setQueryData<Label[]>(boardKeys.labels(boardId), (old) =>
        old ? [...old, label].sort((a, b) => a.name.localeCompare(b.name)) : [label],
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardKeys.labels(boardId) }),
  });
}

// ---------- Checklist ----------

/** POST /cards/:id/checklist — added at the end. */
export function useAddChecklistItem(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  return useMutation({
    mutationFn: (text: string) => addChecklistItem(cardId, text),
    onSuccess: (item) => {
      let items: ChecklistItem[] = [];
      cache.detail((old) => {
        items = [...old.checklistItems, item];
        return { ...old, checklistItems: items };
      });
      cache.summary((old) =>
        items.length
          ? { checklist: checklistCount(items) }
          : { checklist: { ...old.checklist, total: old.checklist.total + 1 } },
      );
    },
    onError: () => void cache.refetch(),
  });
}

/** PATCH /checklist-items/:id — ticking is optimistic, renaming waits for the API. */
export function useUpdateChecklistItem(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  const applyItems = (fn: (items: ChecklistItem[]) => ChecklistItem[]) => {
    let next: ChecklistItem[] | null = null;
    cache.detail((old) => {
      next = fn(old.checklistItems);
      return { ...old, checklistItems: next };
    });
    if (next) {
      const items: ChecklistItem[] = next;
      cache.summary(() => ({ checklist: checklistCount(items) }));
    }
  };
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: { text?: string; done?: boolean } }) =>
      updateChecklistItem(itemId, body),
    onMutate: async ({ itemId, body }) => {
      await cache.cancel();
      const snap = cache.snapshot();
      if (body.done !== undefined) {
        applyItems((items) => items.map((i) => (i.id === itemId ? { ...i, done: body.done! } : i)));
      }
      return snap;
    },
    onSuccess: (item) => applyItems((items) => items.map((i) => (i.id === item.id ? item : i))),
    onError: (_e, _v, snap) => {
      cache.restore(snap);
      void cache.refetch();
    },
  });
}

/** DELETE /checklist-items/:id (optimistic). */
export function useDeleteChecklistItem(cardId: string, boardId: string) {
  const queryClient = useQueryClient();
  const cache = cardCache(queryClient, cardId, boardId);
  return useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem(itemId),
    onMutate: async (itemId) => {
      await cache.cancel();
      const snap = cache.snapshot();
      let items: ChecklistItem[] | null = null;
      cache.detail((old) => {
        items = old.checklistItems.filter((i) => i.id !== itemId);
        return { ...old, checklistItems: items };
      });
      if (items) {
        const left: ChecklistItem[] = items;
        cache.summary(() => ({ checklist: checklistCount(left) }));
      }
      return snap;
    },
    onError: (_e, _v, snap) => {
      cache.restore(snap);
      void cache.refetch();
    },
  });
}
