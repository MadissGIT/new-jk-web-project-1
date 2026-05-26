import type { AccessibilityId } from '../preferences/preferencesStore';
import type { Place } from './types';

const NOISY_PLACE_MARKERS = [
  'bar',
  'club',
  'concert',
  'dance',
  'dj',
  'loud',
  'music',
  'night',
  'party',
  'бар',
  'вечерин',
  'громк',
  'диджей',
  'клуб',
  'концерт',
  'музык',
  'ночн',
  'танц',
];

export function isNoisyPlace(place: Place) {
  const text = [
    place.name,
    place.description,
    place.address,
    ...place.categories,
  ].join(' ').toLowerCase();
  return NOISY_PLACE_MARKERS.some((marker) => text.includes(marker));
}

export function matchesAccessibilityPreferences(
  place: Place,
  accessibility: AccessibilityId[],
) {
  if (accessibility.includes('none')) return true;
  if (accessibility.includes('wheelchair') && !place.accessibility.includes('wheelchair')) {
    return false;
  }
  if (accessibility.includes('ramps') && !place.accessibility.includes('ramps')) {
    return false;
  }
  if (accessibility.includes('avoid_stairs') && !place.accessibility.includes('avoid_stairs')) {
    return false;
  }
  if (accessibility.includes('hearing') && isNoisyPlace(place)) {
    return false;
  }
  return true;
}
