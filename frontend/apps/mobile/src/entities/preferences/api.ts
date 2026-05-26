import { http } from '../../shared/api/http';
import type { AccessibilityId, InterestId, Tempo } from './preferencesStore';

export type BudgetLevel = 'low' | 'medium' | 'high';

export type RemotePreferenceAccessibility = {
  wheelchair_required: boolean;
  avoid_stairs: boolean;
  need_rest_points: boolean;
  with_children: boolean;
  audio_preferred: boolean;
};

export type RemoteUserPreferences = {
  interests: string[];
  pace: Tempo;
  budget_level: BudgetLevel;
  accessibility: RemotePreferenceAccessibility;
};

type DetailResponse<T> = {
  data: T;
};

const allowedInterests = new Set<InterestId>([
  'art',
  'coffee',
  'history',
  'nature',
  'music',
  'relax',
]);

export function toBudgetLevel(max: number | null): BudgetLevel {
  if (max !== null && max <= 2500) return 'low';
  if (max !== null && max > 9000) return 'high';
  return 'medium';
}

export function fromBudgetLevel(level: BudgetLevel): {
  budgetMin: number | null;
  budgetMax: number | null;
} {
  if (level === 'low') return { budgetMin: 0, budgetMax: 2500 };
  if (level === 'high') return { budgetMin: 0, budgetMax: 20000 };
  return { budgetMin: 0, budgetMax: 9000 };
}

export function toRemoteAccessibility(ids: AccessibilityId[]): RemotePreferenceAccessibility {
  return {
    wheelchair_required: ids.includes('wheelchair'),
    avoid_stairs: ids.includes('avoid_stairs'),
    need_rest_points: ids.includes('cane') || ids.includes('ramps'),
    with_children: false,
    audio_preferred: ids.includes('hearing'),
  };
}

export function fromRemoteAccessibility(
  accessibility: RemotePreferenceAccessibility,
): AccessibilityId[] {
  const result: AccessibilityId[] = [];
  if (accessibility.wheelchair_required) result.push('wheelchair');
  if (accessibility.need_rest_points) result.push('ramps');
  if (accessibility.avoid_stairs) result.push('avoid_stairs');
  if (accessibility.audio_preferred) result.push('hearing');
  return result.length ? result : ['none'];
}

export function normalizeRemoteInterests(interests: string[]): InterestId[] {
  return interests.filter((item): item is InterestId => allowedInterests.has(item as InterestId));
}

export async function fetchUserPreferences(): Promise<RemoteUserPreferences> {
  const { data } = await http.get<DetailResponse<RemoteUserPreferences>>('/users/me/preferences');
  return data.data;
}

export async function updateUserPreferences(
  payload: RemoteUserPreferences,
): Promise<RemoteUserPreferences> {
  const { data } = await http.put<DetailResponse<RemoteUserPreferences>>(
    '/users/me/preferences',
    payload,
  );
  return data.data;
}
