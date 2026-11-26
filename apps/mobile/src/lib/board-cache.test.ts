import type { BoardContent, CardSummary } from '@/api/types';
import { moveCardLocal, moveListLocal, positionAt } from './board-cache';

const card = (id: string, position: number): CardSummary => ({
  id,
  title: id,
  dueAt: null,
  position,
  version: 1,
  assignees: [],
  labels: [],
  checklist: { total: 0, done: 0 },
  commentCount: 0,
  attachmentCount: 0,
});

const board = (): BoardContent => ({
  board: {
    id: 'b',
    workspaceId: 'w',
    name: 'Board',
    color: '#2F5BEA',
    visibility: 'WORKSPACE',
    createdById: 'u',
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
    role: 'MEMBER',
  } as BoardContent['board'],
  lists: [
    { id: 'todo', name: 'To do', position: 1000, cards: [card('a', 1000), card('b', 2000), card('c', 3000)] },
    { id: 'done', name: 'Done', position: 2000, cards: [card('d', 1000)] },
  ],
});

const titles = (content: BoardContent, listId: string) =>
  content.lists.find((l) => l.id === listId)!.cards.map((c) => c.id);

describe('positionAt (same rules as the API)', () => {
  it('top, between, end and empty', () => {
    expect(positionAt([], 0)).toBe(1000);
    expect(positionAt([{ position: 1000 }], 0)).toBe(500);
    expect(positionAt([{ position: 1000 }, { position: 2000 }], 1)).toBe(1500);
    expect(positionAt([{ position: 1000 }], 1)).toBe(2000);
  });
});

describe('moveCardLocal (the optimistic update after a drag or Move card)', () => {
  it('moves a card down inside its list', () => {
    const result = moveCardLocal(board(), 'a', 'todo', 2)!;
    expect(titles(result.content, 'todo')).toEqual(['b', 'c', 'a']);
    expect(result.position).toBe(4000);
  });

  it('moves a card to the top of another list', () => {
    const result = moveCardLocal(board(), 'b', 'done', 0)!;
    expect(titles(result.content, 'todo')).toEqual(['a', 'c']);
    expect(titles(result.content, 'done')).toEqual(['b', 'd']);
    expect(result.position).toBe(500);
  });

  it('keeps the lists sorted by position', () => {
    const result = moveCardLocal(board(), 'c', 'todo', 1)!;
    const positions = result.content.lists[0].cards.map((c) => c.position);
    expect([...positions].sort((x, y) => x - y)).toEqual(positions);
  });

  it('treats an index past the end as the end, and leaves the input untouched', () => {
    const before = board();
    const result = moveCardLocal(before, 'a', 'done', 99)!;
    expect(titles(result.content, 'done')).toEqual(['d', 'a']);
    expect(titles(before, 'todo')).toEqual(['a', 'b', 'c']);
  });

  it('returns null for an unknown card or list', () => {
    expect(moveCardLocal(board(), 'zzz', 'todo', 0)).toBeNull();
    expect(moveCardLocal(board(), 'a', 'nope', 0)).toBeNull();
  });
});

describe('moveListLocal', () => {
  it('moves a list to the front', () => {
    const result = moveListLocal(board(), 'done', 0)!;
    expect(result.content.lists.map((l) => l.id)).toEqual(['done', 'todo']);
    expect(result.position).toBe(500);
  });
});
