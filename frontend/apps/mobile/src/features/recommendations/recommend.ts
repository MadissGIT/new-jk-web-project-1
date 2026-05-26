import type { Place } from '../../entities/place/types';
import { isNoisyPlace } from '../../entities/place/accessibility';
import type { PreferencesState } from '../../entities/preferences/preferencesStore';

export type RecommendationInput = Pick<
  PreferencesState,
  | 'interests'
  | 'accessibility'
  | 'tempo'
  | 'budgetMin'
  | 'budgetMax'
  | 'durationMinHours'
  | 'durationMaxHours'
>;

export type ScoredPlace = {
  place: Place;
  score: number;
};

export type Recommendations = {
  items: ScoredPlace[];
  /** true — фильтры ничего не вернули, и мы показываем весь датасет как fallback. */
  relaxed: boolean;
};

// Физические ограничения, требующие инфраструктуры от места. Hearing
// отдельно убирает шумные места вроде клубов и концертных площадок.
const HARD_ACCESSIBILITY: ('wheelchair' | 'ramps' | 'avoid_stairs')[] = [
  'wheelchair',
  'ramps',
  'avoid_stairs',
];

/**
 * Возвращает отсортированный список мест под preferences.
 * Если жёсткие фильтры всё отсекли — отдаёт весь датасет с флагом relaxed=true,
 * чтобы UI мог показать предупреждение вместо пустой выдачи.
 */
export function recommendPlaces(
  places: Place[],
  prefs: RecommendationInput,
): Recommendations {
  const {
    interests,
    accessibility,
    budgetMin,
    budgetMax,
    durationMinHours,
    durationMaxHours,
  } = prefs;

  const hasNoLimits = accessibility.includes('none');
  const accessibilityFilters = hasNoLimits
    ? []
    : accessibility.filter((id): id is (typeof HARD_ACCESSIBILITY)[number] =>
        (HARD_ACCESSIBILITY as readonly string[]).includes(id),
      );

  const scored: ScoredPlace[] = [];

  for (const place of places) {
    if (accessibilityFilters.length > 0) {
      const missing = accessibilityFilters.filter(
        (need) => !place.accessibility.includes(need),
      );
      if (missing.length > 0) continue;
    }

    if (budgetMax != null && place.priceMin != null && place.priceMin > budgetMax) {
      continue;
    }
    if (budgetMin != null && place.priceMax != null && place.priceMax < budgetMin) {
      continue;
    }

    if (durationMaxHours != null && place.durationHours > durationMaxHours) {
      continue;
    }
    if (durationMinHours != null && place.durationHours < durationMinHours) {
      continue;
    }
    if (!hasNoLimits && accessibility.includes('hearing') && isNoisyPlace(place)) {
      continue;
    }

    let score = 0;

    if (interests.length > 0) {
      const overlap = place.categories.filter((cat) =>
        interests.includes(cat),
      ).length;
      score += overlap * 10;
      if (overlap === 0) score -= 3;
    } else {
      score += 5;
    }

    if (place.priceMin === 0 && place.priceMax === 0) score += 1;
    if (accessibility.includes('hearing') && isNoisyPlace(place)) score -= 12;

    scored.push({ place, score });
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      items: places.map((place) => ({ place, score: 0 })),
      relaxed: true,
    };
  }

  return { items: scored, relaxed: false };
}

export function formatPriceRange(place: Place): string {
  if (place.priceMin === 0 && place.priceMax === 0) return 'Бесплатно';
  if (place.priceMin != null && place.priceMax != null) {
    if (place.priceMin === place.priceMax) return `${place.priceMin} ₽`;
    return `${place.priceMin}–${place.priceMax} ₽`;
  }
  if (place.priceMax != null) return `до ${place.priceMax} ₽`;
  if (place.priceMin != null) return `от ${place.priceMin} ₽`;
  return '—';
}

export function formatDurationHours(hours: number): string {
  const rounded = Math.round(hours);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  if (mod10 === 1 && mod100 !== 11) return `${rounded} час`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${rounded} часа`;
  return `${rounded} часов`;
}
