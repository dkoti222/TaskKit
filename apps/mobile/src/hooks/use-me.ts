import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/api/users';

export const meQueryKey = ['me'] as const;

export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: getMe });
}
