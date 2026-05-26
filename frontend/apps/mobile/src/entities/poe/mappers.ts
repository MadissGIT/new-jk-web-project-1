import type { AccessibilityId, InterestId } from '../preferences/preferencesStore';
import type { Place } from '../place/types';
import type { PoePublic } from './types';

const CATEGORY_TO_INTEREST: Record<string, InterestId> = {
  art: 'art',
  arts: 'art',
  museum: 'art',
  gallery: 'art',
  coffee: 'coffee',
  cafe: 'coffee',
  history: 'history',
  historic: 'history',
  nature: 'nature',
  park: 'nature',
  music: 'music',
  relax: 'relax',
  leisure: 'relax',
};

function inferInterests(poe: PoePublic): InterestId[] {
  const bag = [poe.category, ...poe.tags].map((value) => value.toLowerCase());
  const result = new Set<InterestId>();
  for (const token of bag) {
    const mapped = CATEGORY_TO_INTEREST[token];
    if (mapped) result.add(mapped);
  }
  if (result.size === 0) {
    result.add('relax');
  }
  return [...result];
}

function mapAccessibility(poe: PoePublic): AccessibilityId[] {
  const result: AccessibilityId[] = [];
  if (poe.accessibility.wheelchair_accessible) result.push('wheelchair');
  if (poe.accessibility.has_ramp) result.push('ramps');
  // «avoid_stairs» — это потребность пользователя; место удовлетворяет ей,
  // когда у него нет лестниц на входе/внутри. Иначе ставим обратный пометки нет.
  if (!poe.accessibility.has_stairs) result.push('avoid_stairs');
  if (result.length === 0) result.push('none');
  return result;
}

export function poeToPlace(poe: PoePublic): Place {
  const durationHours = Math.max(1, Math.round(poe.duration_minutes / 60));
  return {
    id: poe.id,
    name: poe.title,
    description: poe.description,
    categories: inferInterests(poe),
    priceMin: null,
    priceMax: null,
    durationHours,
    lat: poe.location.lat,
    lng: poe.location.lng,
    address: poe.location.address ?? 'Адрес не указан',
    accessibility: mapAccessibility(poe),
  };
}
