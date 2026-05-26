import { useMutation, useQuery } from '@tanstack/react-query';

import {
  fetchRoutes,
  finishRoute,
  generateRoute,
  saveRoute,
  startRoute,
  updateRouteProgress,
} from './api';

export function useGenerateRoute() {
  return useMutation({
    mutationFn: generateRoute,
  });
}

export function useRouteHistory(enabled = true) {
  return useQuery({
    queryKey: ['routes', 'history'],
    queryFn: () => fetchRoutes({ page: 1, limit: 20 }),
    enabled,
    staleTime: 30_000,
  });
}

export function useSaveRoute() {
  return useMutation({
    mutationFn: saveRoute,
  });
}

export function useStartRoute() {
  return useMutation({
    mutationFn: startRoute,
  });
}

export function useUpdateRouteProgress() {
  return useMutation({
    mutationFn: ({ routeId, order }: { routeId: string; order: number }) =>
      updateRouteProgress(routeId, { order }),
  });
}

export function useFinishRoute() {
  return useMutation({
    mutationFn: finishRoute,
  });
}
