import { QueryClient } from '@tanstack/react-query';

import { useSession } from '@/store/session';
import { getErrorStatus } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network/server errors twice, but never 4xx (they won't fix themselves).
      retry: (failureCount, error) => {
        const status = getErrorStatus(error);
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

// Drop cached data from the previous user whenever the session ends.
useSession.subscribe((state, prev) => {
  if (prev.status === 'signedIn' && state.status !== 'signedIn') {
    queryClient.clear();
  }
});
