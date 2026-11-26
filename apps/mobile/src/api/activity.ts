import { api } from './client';
import type { ActivityItem, ActivityKind, ArchivedItems, Comment, Page } from './types';

// ---------- Comments (Owner, Admin, Member write; anyone with access reads) ----------

/** `body` may contain `@[<userId>]` mention tokens. 1–5000 characters. */
export async function createComment(cardId: string, body: string) {
  const { data } = await api.post<Comment>(`/cards/${cardId}/comments`, { body });
  return data;
}

/** Author only (403 otherwise). */
export async function updateComment(commentId: string, body: string) {
  const { data } = await api.patch<Comment>(`/comments/${commentId}`, { body });
  return data;
}

/** The author, or a board Owner or Admin. */
export async function deleteComment(commentId: string) {
  await api.delete(`/comments/${commentId}`);
}

// ---------- Activity (newest first, cursor pages) ----------

/** 15 · Card detail's "Comments and activity". Comment entries carry the comment. */
export async function listCardActivity(cardId: string, cursor?: string | null) {
  const { data } = await api.get<Page<ActivityItem>>(`/cards/${cardId}/activity`, {
    params: { cursor: cursor ?? undefined, limit: 20 },
  });
  return data;
}

/** 20 · Board activity. */
export async function listBoardActivity(
  boardId: string,
  kind: ActivityKind,
  cursor?: string | null,
) {
  const { data } = await api.get<Page<ActivityItem>>(`/boards/${boardId}/activity`, {
    params: { kind, cursor: cursor ?? undefined, limit: 20 },
  });
  return data;
}

// ---------- Archived items (18) ----------

export async function getArchived(boardId: string) {
  const { data } = await api.get<ArchivedItems>(`/boards/${boardId}/archived`);
  return data;
}

export async function restoreList(listId: string) {
  await api.post(`/lists/${listId}/restore`);
}

export async function restoreCard(cardId: string) {
  await api.post(`/cards/${cardId}/restore`);
}
