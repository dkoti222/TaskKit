import { api } from './client';
import type { MessageResponse } from './types';

/** One signed-in device (a login session). */
export type Session = {
  id: string;
  /** "iPhone 15 · iOS 18.1", or null for logins from before device names existed. */
  deviceName: string | null;
  signedInAt: string;
  lastActiveAt: string;
  /** This phone. */
  current: boolean;
};

export async function listSessions() {
  const { data } = await api.get<Session[]>('/me/sessions');
  return data;
}

/** Signs out every device but this one (they stop working at their next refresh, ≤15 min). */
export async function logoutOtherDevices() {
  const { data } = await api.post<MessageResponse & { count: number }>(
    '/me/sessions/logout-others',
  );
  return data;
}
