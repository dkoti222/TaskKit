import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// The token from the last invite link the user opened but hasn't accepted or declined.
// There's no "list my invites" API, so this is what powers the invite card on Home, and it
// survives logging in (a logged-out user who opens the link sees the card after logging in).
const KEY = 'taskkit.pendingInvite';

type PendingInviteState = {
  token: string | null;
  hydrate: () => Promise<void>;
  save: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};

export const usePendingInvite = create<PendingInviteState>()((set, get) => ({
  token: null,

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(KEY);
      // Don't overwrite a token saved by a deep link that arrived while we were reading.
      if (token && !get().token) set({ token });
    } catch {
      // Not critical: the user can still open the link again.
    }
  },

  save: async (token) => {
    if (get().token === token) return;
    set({ token });
    try {
      await SecureStore.setItemAsync(KEY, token);
    } catch {
      // Kept in memory for this session.
    }
  },

  clear: async () => {
    set({ token: null });
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // Nothing useful to do.
    }
  },
}));

/**
 * Pulls the token out of whatever the user pasted: taskkit://invite/<token>,
 * exp://…/--/invite/<token> (Expo Go), an https link ending in /invite/<token>, or the bare token.
 */
export function parseInviteToken(input: string): string | null {
  const text = input.trim();
  const fromLink = text.match(/invite\/([A-Za-z0-9_-]{16,})/);
  if (fromLink) return fromLink[1];
  return /^[A-Za-z0-9_-]{16,}$/.test(text) ? text : null;
}
