import { useSession } from '@/store/session';
import { api } from './client';
import type { AuthResponse, MessageResponse } from './types';

export async function register(body: { name: string; email: string; password: string }) {
  const { data } = await api.post<MessageResponse>('/auth/register', body);
  return data;
}

export async function verifyEmail(body: { email: string; code: string }) {
  const { data } = await api.post<AuthResponse>('/auth/verify-email', body);
  return data;
}

export async function resendCode(body: { email: string }) {
  const { data } = await api.post<MessageResponse>('/auth/resend-code', body);
  return data;
}

export async function login(body: { email: string; password: string }) {
  const { data } = await api.post<AuthResponse>('/auth/login', body);
  return data;
}

/** Always succeeds with the same message, whether or not the email exists. */
export async function forgotPassword(body: { email: string }) {
  const { data } = await api.post<MessageResponse>('/auth/forgot-password', body);
  return data;
}

/** Sets a new password from the emailed link. The API then revokes every refresh token. */
export async function resetPassword(body: { token: string; password: string }) {
  const { data } = await api.post<MessageResponse>('/auth/reset-password', body);
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
