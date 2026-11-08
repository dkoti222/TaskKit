import { api } from './client';
import type { User } from './types';

export async function getMe() {
  const { data } = await api.get<User>('/me');
  return data;
}
