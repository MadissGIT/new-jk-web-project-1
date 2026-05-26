import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

import { useAuthStore } from '../auth/authStore';
import {
  fetchUserPreferences,
  fromBudgetLevel,
  fromRemoteAccessibility,
  normalizeRemoteInterests,
  toBudgetLevel,
  toRemoteAccessibility,
  updateUserPreferences,
  type RemoteUserPreferences,
} from './api';
import { usePreferencesStore } from './preferencesStore';

export function useRemotePreferencesBootstrap() {
  const token = useAuthStore((s) => s.token);
  const prefsHydrated = usePreferencesStore((s) => s._hasHydrated);
  const applyRemotePreferences = usePreferencesStore((s) => s.applyRemotePreferences);

  const query = useQuery({
    queryKey: ['preferences', 'me'],
    queryFn: fetchUserPreferences,
    enabled: Boolean(token) && prefsHydrated,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!query.data) return;
    const budget = fromBudgetLevel(query.data.budget_level);
    applyRemotePreferences({
      interests: normalizeRemoteInterests(query.data.interests),
      accessibility: fromRemoteAccessibility(query.data.accessibility),
      tempo: query.data.pace,
      budgetMin: budget.budgetMin,
      budgetMax: budget.budgetMax,
    });
  }, [applyRemotePreferences, query.data]);

  return query;
}

export function useSavePreferences() {
  const interests = usePreferencesStore((s) => s.interests);
  const accessibility = usePreferencesStore((s) => s.accessibility);
  const tempo = usePreferencesStore((s) => s.tempo);
  const budgetMax = usePreferencesStore((s) => s.budgetMax);

  const payload = useMemo<RemoteUserPreferences>(
    () => ({
      interests,
      pace: tempo ?? 'medium',
      budget_level: toBudgetLevel(budgetMax),
      accessibility: toRemoteAccessibility(accessibility),
    }),
    [accessibility, budgetMax, interests, tempo],
  );

  return useMutation({
    mutationFn: (override?: Partial<RemoteUserPreferences>) =>
      updateUserPreferences({ ...payload, ...override }),
  });
}
