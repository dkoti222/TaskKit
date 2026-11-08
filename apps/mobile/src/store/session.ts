import { create } from 'zustand';

import type { TokenPair } from '@/api/types';
import { clearTokens, loadTokens, saveTokens } from './token-storage';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

/** One-off message shown on the Log in screen (e.g. after the session expired). */
export type SessionNotice = { tone: 'error' | 'success'; message: string };

type SessionState = {
  status: SessionStatus;
  accessToken: string | null;
  refreshToken: string | null;
  notice: SessionNotice | null;

  /** Reads saved tokens from SecureStore once at app start. */
  hydrate: () => Promise<void>;
  /** Saves a new token pair and marks the user as signed in. */
  signIn: (tokens: TokenPair) => Promise<void>;
  /** Saves a rotated token pair (after /auth/refresh). */
  setTokens: (tokens: TokenPair) => Promise<void>;
  /** Clears tokens locally. Use logOut() in src/api/auth.ts to also revoke on the server. */
  signOut: (notice?: SessionNotice) => Promise<void>;
  clearNotice: () => void;
};

export const SESSION_EXPIRED: SessionNotice = {
  tone: 'error',
  message: 'Your session expired. Log in again.',
};

export const useSession = create<SessionState>()((set) => ({
  status: 'loading',
  accessToken: null,
  refreshToken: null,
  notice: null,

  hydrate: async () => {
    try {
      const tokens = await loadTokens();
      set(tokens ? { ...tokens, status: 'signedIn' } : { status: 'signedOut' });
    } catch {
      set({ status: 'signedOut' });
    }
  },

  signIn: async (tokens) => {
    await saveTokens(tokens);
    set({ ...tokens, status: 'signedIn', notice: null });
  },

  setTokens: async (tokens) => {
    // Save before anything uses the new pair: the old refresh token is now dead,
    // and re-using it would log out every device.
    await saveTokens(tokens);
    set(tokens);
  },

  signOut: async (notice) => {
    set({ status: 'signedOut', accessToken: null, refreshToken: null, notice: notice ?? null });
    try {
      await clearTokens();
    } catch {
      // Nothing useful to do; in-memory state is already cleared.
    }
  },

  clearNotice: () => set({ notice: null }),
}));
