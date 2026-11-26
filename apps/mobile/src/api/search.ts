import { api } from './client';
import type { Page, SearchParams, SearchResult } from './types';

/** Only boards you can see are searched. Needs a query or at least one filter (else 400). */
export async function searchCards(
  workspaceId: string,
  params: SearchParams,
  cursor?: string | null,
  signal?: AbortSignal,
) {
  const { data } = await api.get<Page<SearchResult>>(`/workspaces/${workspaceId}/search`, {
    params: { ...params, cursor: cursor ?? undefined, limit: 20 },
    signal,
  });
  return data;
}
