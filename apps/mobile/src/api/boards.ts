import { api } from './client';
import type {
  AssignableRole,
  Board,
  BoardFields,
  BoardMember,
  BoardContent,
  BoardVisibility,
  Label,
  MessageResponse,
} from './types';

export type BoardInput = { name: string; color?: string; visibility?: BoardVisibility };

// ---------- Boards ----------

/** Active boards, or archived ones with archived=true. Private boards only if you can see them. */
export async function listBoards(workspaceId: string, archived = false) {
  const { data } = await api.get<Board[]>(`/workspaces/${workspaceId}/boards`, {
    params: archived ? { archived: true } : undefined,
  });
  return data;
}

/** Workspace Owner, Admin and Member. The creator becomes board Admin (Owner stays Owner). */
export async function createBoard(workspaceId: string, body: BoardInput) {
  const { data } = await api.post<Board>(`/workspaces/${workspaceId}/boards`, body);
  return data;
}

/** 404 when the board doesn't exist or you can't see it. */
export async function getBoard(id: string) {
  const { data } = await api.get<Board>(`/boards/${id}`);
  return data;
}

/** Board Owner, Admin. */
export async function updateBoard(id: string, body: Partial<BoardInput>) {
  const { data } = await api.patch<BoardFields>(`/boards/${id}`, body);
  return data;
}

/** Board Owner, Admin. */
export async function archiveBoard(id: string) {
  const { data } = await api.post<BoardFields>(`/boards/${id}/archive`);
  return data;
}

/** Board Owner, Admin. */
export async function restoreBoard(id: string) {
  const { data } = await api.post<BoardFields>(`/boards/${id}/restore`);
  return data;
}

// ---------- Board members ----------

export async function listBoardMembers(boardId: string) {
  const { data } = await api.get<BoardMember[]>(`/boards/${boardId}/members`);
  return data;
}

/** Board Owner, Admin. Adds the person or changes their role. Must be a workspace member. */
export async function setBoardMemberRole(boardId: string, userId: string, role: AssignableRole) {
  const { data } = await api.put(`/boards/${boardId}/members/${userId}`, { role });
  return data;
}

/** Board Owner, Admin. */
export async function removeBoardMember(boardId: string, userId: string) {
  const { data } = await api.delete<MessageResponse>(`/boards/${boardId}/members/${userId}`);
  return data;
}

// ---------- Board content and labels ----------

/** Lists (by position) with their cards (by position). `board.role` is your effective role. */
export async function getBoardContent(boardId: string) {
  const { data } = await api.get<BoardContent>(`/boards/${boardId}/content`);
  return data;
}

/** Every role can read the board's labels. */
export async function listLabels(boardId: string) {
  const { data } = await api.get<Label[]>(`/boards/${boardId}/labels`);
  return data;
}

/** Board Owner, Admin. `color` must be a hex colour like #D9465A. */
export async function createLabel(boardId: string, body: { name: string; color: string }) {
  const { data } = await api.post<Label>(`/boards/${boardId}/labels`, body);
  return data;
}
