import { api } from './client';
import type { ListFields, MovedList } from './types';

// Every call here needs board Owner, Admin or Member (Viewers get 403).

/** Added at the end of the board. Name: 1–100 characters. */
export async function createList(boardId: string, name: string) {
  const { data } = await api.post<ListFields>(`/boards/${boardId}/lists`, { name });
  return data;
}

export async function renameList(listId: string, name: string) {
  const { data } = await api.patch<ListFields>(`/lists/${listId}`, { name });
  return data;
}

/** Hides the list and its cards from the board. */
export async function archiveList(listId: string) {
  const { data } = await api.post<ListFields>(`/lists/${listId}/archive`);
  return data;
}

/** `index` is the new place among the board's other lists (0 = first). */
export async function moveList(listId: string, index: number) {
  const { data } = await api.patch<MovedList>(`/lists/${listId}/move`, { index });
  return data;
}
