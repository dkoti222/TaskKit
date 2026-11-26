import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

// The last few searches, kept on this phone only (like the pending invite, in SecureStore: small,
// and no extra storage package). Cleared on logout.
const KEY = 'taskkit.recentSearches';
const MAX = 8;

type RecentSearches = {
  items: string[];
  hydrate: () => Promise<void>;
  add: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
};

const persist = (items: string[]) => {
  SecureStore.setItemAsync(KEY, JSON.stringify(items)).catch(() => undefined);
};

export const useRecentSearches = create<RecentSearches>()((set, get) => ({
  items: [],
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) set({ items: JSON.parse(raw) as string[] });
    } catch {
      // Not important: start with none.
    }
  },
  add: (query) => {
    const q = query.trim().slice(0, 60);
    if (q.length < 2) return;
    const items = [q, ...get().items.filter((i) => i.toLowerCase() !== q.toLowerCase())].slice(
      0,
      MAX,
    );
    set({ items });
    persist(items);
  },
  remove: (query) => {
    const items = get().items.filter((i) => i !== query);
    set({ items });
    persist(items);
  },
  clear: () => {
    set({ items: [] });
    SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  },
}));
