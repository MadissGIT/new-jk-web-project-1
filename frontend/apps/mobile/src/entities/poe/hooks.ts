import { useQuery } from '@tanstack/react-query';

import { fetchPoeDetail, fetchPoeReviews, fetchPoes } from './api';
import type { PoeQuery } from './types';

export function usePoes(query: PoeQuery) {
  return useQuery({
    queryKey: ['poe', 'list', query],
    queryFn: () => fetchPoes(query),
    staleTime: 60_000,
  });
}

export function usePoeDetail(poeId: string | null) {
  return useQuery({
    queryKey: ['poe', 'detail', poeId],
    queryFn: () => fetchPoeDetail(poeId as string),
    enabled: Boolean(poeId),
    staleTime: 60_000,
  });
}

export function usePoeReviews(poeId: string | null) {
  return useQuery({
    queryKey: ['poe', 'reviews', poeId],
    queryFn: () => fetchPoeReviews(poeId as string, { limit: 20 }),
    enabled: Boolean(poeId),
    staleTime: 30_000,
  });
}
