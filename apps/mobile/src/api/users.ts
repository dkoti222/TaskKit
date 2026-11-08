import { api } from './client';
import type { MessageResponse, User } from './types';

export async function getMe() {
  const { data } = await api.get<User>('/me');
  return data;
}

export async function updateMe(body: { name?: string; timezone?: string; avatarUrl?: string }) {
  const { data } = await api.patch<User>('/me', body);
  return data;
}

/** Deletes the account. The API checks the password (400 if wrong) and revokes every session. */
export async function deleteMe(body: { password: string }) {
  const { data } = await api.delete<MessageResponse>('/me', { data: body });
  return data;
}
