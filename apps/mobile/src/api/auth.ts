import { useSession } from '@/store/session';
import { api } from './client';
import type { AuthResponse, MessageResponse } from './types';

export async function login(body: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', body);
  return data;
}

/** Revokes the refresh token on the server (best effort), then clears the local session. */
export async function logOut() {
  const { refreshToken, signOut } = useSession.getState();
  if (refreshToken) {
    try {
      await api.post<MessageResponse>('/auth/logout', { refreshToken }, { timeout: 5_000 });
    } catch {
      // Still log out locally if the server can't be reached.
    }
  }
  await signOut();
}
