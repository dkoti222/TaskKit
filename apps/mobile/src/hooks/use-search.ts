import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchCards } from '@/api/search';
import type { SearchParams } from '@/api/types';

/** The value, once it has stopped changing for `ms` (typing → one request, not one per key). */
export function useDebounced<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/**
 * 21 · Search results, page by page. Runs once there's a query or a filter. Old results stay on
 * screen while new ones load, and a request for an outdated query is cancelled.
 */
export function useSearch(workspaceId: string | undefined, params: SearchParams) {
  const active = !!workspaceId && Object.values(params).some(Boolean);
  return useInfiniteQuery({
    queryKey: ['search', workspaceId, params],
    queryFn: ({ pageParam, signal }) => searchCards(workspaceId!, params, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: active,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}
