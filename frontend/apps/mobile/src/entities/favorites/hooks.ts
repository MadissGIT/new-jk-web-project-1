import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert } from 'react-native';

import { useAuthStore } from '../auth/authStore';
import {
  addFavorite,
  fetchFavorites,
  removeFavorite,
  type FavoriteEntityType,
  type FavoritesPayload,
} from './api';

export function useFavoritesQuery() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ['favorites'],
    queryFn: fetchFavorites,
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: 1,
  });
}

/** @deprecated используйте useFavoritesQuery */
export function useFavoritesBootstrap() {
  return useFavoritesQuery();
}

export function useFavoriteSets() {
  const query = useFavoritesQuery();
  return useMemo(() => {
    const payload = query.data;
    return {
      poeIds: new Set((payload?.poes ?? []).map((item) => item.id)),
      tourIds: new Set((payload?.tours ?? []).map((item) => item.id)),
      routeIds: new Set((payload?.routes ?? []).map((item) => item.id)),
    };
  }, [query.data]);
}

export function useIsFavorite(entityType: FavoriteEntityType, entityId: string | null) {
  const sets = useFavoriteSets();
  if (!entityId) return false;
  if (entityType === 'poe') return sets.poeIds.has(entityId);
  if (entityType === 'tour') return sets.tourIds.has(entityId);
  return sets.routeIds.has(entityId);
}

function patchFavoritesCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (current: FavoritesPayload) => FavoritesPayload,
) {
  queryClient.setQueryData<FavoritesPayload>(['favorites'], (current) => {
    if (!current) return current;
    return updater(current);
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const sets = useFavoriteSets();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      isFavorite,
    }: {
      entityType: FavoriteEntityType;
      entityId: string;
      title?: string;
      isFavorite: boolean;
    }) => {
      if (!token) {
        Alert.alert('Войдите в аккаунт', 'Избранное сохраняется в вашем профиле после входа.');
        throw new Error('auth_required');
      }
      return isFavorite
        ? removeFavorite({ entity_type: entityType, entity_id: entityId })
        : addFavorite({ entity_type: entityType, entity_id: entityId });
    },
    onMutate: async ({ entityType, entityId, title, isFavorite }) => {
      if (!token) return;
      await queryClient.cancelQueries({ queryKey: ['favorites'] });
      const previous = queryClient.getQueryData<FavoritesPayload>(['favorites']);
      const label = title?.trim() || 'Без названия';

      patchFavoritesCache(queryClient, (current) => {
        if (entityType === 'poe') {
          const poes = isFavorite
            ? current.poes.filter((item) => item.id !== entityId)
            : [...current.poes, { id: entityId, title: label }];
          return { ...current, poes };
        }
        if (entityType === 'tour') {
          const tours = isFavorite
            ? current.tours.filter((item) => item.id !== entityId)
            : [...current.tours, { id: entityId, title: label }];
          return { ...current, tours };
        }
        const routes = isFavorite
          ? current.routes.filter((item) => item.id !== entityId)
          : [...current.routes, { id: entityId, title: label }];
        return { ...current, routes };
      });

      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['favorites'], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
}

export function useTogglePoeFavorite() {
  const toggle = useToggleFavorite();
  const sets = useFavoriteSets();

  return {
    ...toggle,
    mutate: (poeId: string, title?: string) => {
      toggle.mutate({
        entityType: 'poe',
        entityId: poeId,
        title,
        isFavorite: sets.poeIds.has(poeId),
      });
    },
    mutateAsync: async (poeId: string, title?: string) =>
      toggle.mutateAsync({
        entityType: 'poe',
        entityId: poeId,
        title,
        isFavorite: sets.poeIds.has(poeId),
      }),
  };
}

export function useToggleTourFavorite(tourId: string) {
  const toggle = useToggleFavorite();
  const isFavorite = useIsFavorite('tour', tourId);

  return {
    isFavorite,
    isPending: toggle.isPending,
    toggleFavorite: (title?: string) => {
      toggle.mutate({
        entityType: 'tour',
        entityId: tourId,
        title,
        isFavorite,
      });
    },
  };
}
