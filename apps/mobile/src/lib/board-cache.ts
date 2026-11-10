import type { BoardContent, BoardList, CardSummary } from '@/api/types';

// Pure helpers that edit a cached GET /boards/:id/content response. They never mutate their
// input, so TanStack Query sees a new object and re-renders.

const GAP = 1000;

/**
 * Same maths as the API's positionAt(): the position for an item dropped at `index` among
 * `siblings` (sorted, without the moved item). The API may renumber the list when neighbours
 * are too close; we only use this for the optimistic order, and the response's position wins.
 */
export function positionAt(siblings: { position: number }[], index: number): number {
  const before = siblings[index - 1]?.position;
  const after = siblings[index]?.position;
  if (before === undefined && after === undefined) return GAP;
  if (before === undefined) return after! / 2;
  if (after === undefined) return before + GAP;
  return (before + after) / 2;
}

export const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function findCard(content: BoardContent | undefined, cardId: string) {
  for (const list of content?.lists ?? []) {
    const card = list.cards.find((c) => c.id === cardId);
    if (card) return { list, card };
  }
  return undefined;
}

/** Moves a card to `index` in `toListId` (index among the other cards, like the API). */
export function moveCardLocal(
  content: BoardContent,
  cardId: string,
  toListId: string,
  index: number,
): { content: BoardContent; position: number } | null {
  const found = findCard(content, cardId);
  const target = content.lists.find((l) => l.id === toListId);
  if (!found || !target) return null;

  const siblings = target.cards.filter((c) => c.id !== cardId);
  const at = Math.min(Math.max(index, 0), siblings.length);
  const position = positionAt(siblings, at);
  const moved: CardSummary = { ...found.card, position };
  const nextTarget = [...siblings.slice(0, at), moved, ...siblings.slice(at)];

  return {
    position,
    content: {
      ...content,
      lists: content.lists.map((list) => {
        if (list.id === toListId) return { ...list, cards: nextTarget };
        if (list.id === found.list.id)
          return { ...list, cards: list.cards.filter((c) => c.id !== cardId) };
        return list;
      }),
    },
  };
}

/** Moves a list to `index` among the other lists. */
export function moveListLocal(
  content: BoardContent,
  listId: string,
  index: number,
): { content: BoardContent; position: number } | null {
  const list = content.lists.find((l) => l.id === listId);
  if (!list) return null;
  const siblings = content.lists.filter((l) => l.id !== listId);
  const at = Math.min(Math.max(index, 0), siblings.length);
  const position = positionAt(siblings, at);
  return {
    position,
    content: {
      ...content,
      lists: [...siblings.slice(0, at), { ...list, position }, ...siblings.slice(at)],
    },
  };
}

export function patchCard(
  content: BoardContent,
  cardId: string,
  patch: Partial<CardSummary> | ((card: CardSummary) => Partial<CardSummary>),
): BoardContent {
  return {
    ...content,
    lists: content.lists.map((list) =>
      list.cards.some((c) => c.id === cardId)
        ? {
            ...list,
            cards: list.cards.map((c) =>
              c.id === cardId ? { ...c, ...(typeof patch === 'function' ? patch(c) : patch) } : c,
            ),
          }
        : list,
    ),
  };
}

export function removeCard(content: BoardContent, cardId: string): BoardContent {
  return {
    ...content,
    lists: content.lists.map((list) => ({
      ...list,
      cards: list.cards.filter((c) => c.id !== cardId),
    })),
  };
}

export function patchList(
  content: BoardContent,
  listId: string,
  patch: (list: BoardList) => BoardList | null,
): BoardContent {
  const lists: BoardList[] = [];
  for (const list of content.lists) {
    if (list.id !== listId) lists.push(list);
    else {
      const next = patch(list);
      if (next) lists.push(next);
    }
  }
  return { ...content, lists };
}
