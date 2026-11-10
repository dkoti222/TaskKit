import { api } from './client';
import type {
  CardDetail,
  CardFields,
  CardPerson,
  ChecklistItem,
  Label,
  MessageResponse,
  MovedCard,
} from './types';

// Reading is open to every role. Everything else needs board Owner, Admin or Member.

export type NewCardInput = { title: string; description?: string; dueAt?: string };
export type CardUpdate = { title?: string; description?: string | null; dueAt?: string | null };

/** Added at the bottom of the list. */
export async function createCard(listId: string, body: NewCardInput) {
  const { data } = await api.post<CardFields>(`/lists/${listId}/cards`, body);
  return data;
}

export async function getCard(cardId: string) {
  const { data } = await api.get<CardDetail>(`/cards/${cardId}`);
  return data;
}

/** `dueAt: null` clears the due date. Bumps the card's version. */
export async function updateCard(cardId: string, body: CardUpdate) {
  const { data } = await api.patch<CardFields>(`/cards/${cardId}`, body);
  return data;
}

export async function archiveCard(cardId: string) {
  const { data } = await api.post<CardFields>(`/cards/${cardId}/archive`);
  return data;
}

/**
 * Puts the card at `index` among the target list's other cards. `version` must be the card's
 * current version, otherwise 409 ("This card was changed by someone else…").
 */
export async function moveCard(
  cardId: string,
  body: { listId: string; index: number; version: number },
) {
  const { data } = await api.patch<MovedCard>(`/cards/${cardId}/move`, body);
  return data;
}

// ---------- Assignees and labels (each returns the card's full list afterwards) ----------

/** 400 if the person can't be assigned (no access, or Viewer on this board). */
export async function addAssignee(cardId: string, userId: string) {
  const { data } = await api.put<CardPerson[]>(`/cards/${cardId}/assignees/${userId}`);
  return data;
}

export async function removeAssignee(cardId: string, userId: string) {
  const { data } = await api.delete<CardPerson[]>(`/cards/${cardId}/assignees/${userId}`);
  return data;
}

export async function addCardLabel(cardId: string, labelId: string) {
  const { data } = await api.put<Label[]>(`/cards/${cardId}/labels/${labelId}`);
  return data;
}

export async function removeCardLabel(cardId: string, labelId: string) {
  const { data } = await api.delete<Label[]>(`/cards/${cardId}/labels/${labelId}`);
  return data;
}

// ---------- Checklist ----------

export async function addChecklistItem(cardId: string, text: string) {
  const { data } = await api.post<ChecklistItem>(`/cards/${cardId}/checklist`, { text });
  return data;
}

export async function updateChecklistItem(itemId: string, body: { text?: string; done?: boolean }) {
  const { data } = await api.patch<ChecklistItem>(`/checklist-items/${itemId}`, body);
  return data;
}

export async function deleteChecklistItem(itemId: string) {
  const { data } = await api.delete<MessageResponse>(`/checklist-items/${itemId}`);
  return data;
}
