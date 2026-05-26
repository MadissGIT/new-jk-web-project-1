import { demoPlaces, EKATERINBURG_CENTER } from '../place/places';
import { isNoisyPlace } from '../place/accessibility';
import type { Place } from '../place/types';
import type { PoeDetail } from '../poe/types';
import type { AccessibilityId, InterestId, Tempo } from '../preferences/preferencesStore';
import { ART_AND_COFFEE_ROUTE } from './readyRoutes';
import type { RouteGeneratedPublic, RoutePace } from './types';

type GenerateLocalRouteInput = {
  places: Place[];
  draftPoeIds: string[];
  interests: InterestId[];
  accessibility: AccessibilityId[];
  tempo: Tempo | null;
  budgetMin: number | null;
  budgetMax: number | null;
  durationMinHours: number | null;
  durationMaxHours: number | null;
  startLocation?: { lat: number; lng: number; address?: string | null };
};

export type RouteScenario = {
  id: string;
  title: string;
  description: string;
  interests: InterestId[];
  durationMinutes: number;
  pace: RoutePace;
  stops: Array<Place & { stopMinutes: number }>;
};

const INTEREST_TITLES: Record<InterestId, string> = {
  art: 'Искусство',
  coffee: 'кофе',
  history: 'история',
  nature: 'зеленый маршрут',
  music: 'музыка',
  relax: 'спокойный маршрут',
};

const ROUTE_SPEED_METERS_PER_MINUTE: Record<RoutePace, number> = {
  slow: 55,
  medium: 70,
  fast: 85,
};

export const ROUTE_SCENARIOS: RouteScenario[] = [
  {
    id: 'history-center',
    title: 'История',
    description: 'Исторический центр Екатеринбурга: Плотинка, Plan ART, Ельцин Центр и Харитоновский сад.',
    interests: ['history', 'art', 'nature'],
    durationMinutes: 360,
    pace: 'medium',
    stops: [
      {
        id: 'plotinka-history-square',
        name: 'Плотинка',
        description:
          'Исторический сквер на проспекте Ленина. Центральная прогулочная точка города с широкими аллеями, пандусами и выходом к воде.',
        categories: ['history', 'nature', 'relax'],
        priceMin: 0,
        priceMax: 0,
        durationHours: 1,
        stopMinutes: 60,
        lat: 56.8379,
        lng: 60.6055,
        address: 'ул. Воеводина, 1',
        accessibility: ['wheelchair', 'ramps', 'avoid_stairs'],
      },
      {
        id: 'plan-art-l52',
        name: 'Галерея Plan ART',
        description:
          'Галерея современного искусства в креативном кластере Л52. Пространство адаптировано для маломобильных посетителей: пандус, широкие проходы, без лестниц между зонами.',
        categories: ['art', 'history'],
        priceMin: 0,
        priceMax: 500,
        durationHours: 1,
        stopMinutes: 60,
        lat: 56.8392,
        lng: 60.6031,
        address: 'пр. Ленина, 52',
        accessibility: ['wheelchair', 'ramps', 'avoid_stairs'],
      },
      {
        id: 'yeltsin-center-history',
        name: 'Ельцин Центр',
        description:
          'Культурный центр, музей и выставочное пространство. В здании есть доступный вход, пандусы, лифты, широкие проходы и оборудованные туалеты.',
        categories: ['history', 'art'],
        priceMin: 0,
        priceMax: 700,
        durationHours: 2,
        stopMinutes: 120,
        lat: 56.840742,
        lng: 60.592534,
        address: 'ул. Бориса Ельцина, 3',
        accessibility: ['wheelchair', 'ramps', 'avoid_stairs'],
      },
      {
        id: 'kharitonovsky-garden-history',
        name: 'Харитоновский сад',
        description:
          'Исторический английский парк у усадьбы Расторгуевых-Харитоновых. Круговая аллея, пруд, скамейки и широкие прогулочные дорожки.',
        categories: ['history', 'nature', 'relax'],
        priceMin: 0,
        priceMax: 0,
        durationHours: 1,
        stopMinutes: 60,
        lat: 56.8458,
        lng: 60.6125,
        address: 'ул. Карла Либкнехта, 44',
        accessibility: ['wheelchair', 'avoid_stairs'],
      },
    ],
  },
];

const FALLBACK_PLACES = [
  ...ROUTE_SCENARIOS.flatMap((scenario) => scenario.stops),
  ...ART_AND_COFFEE_ROUTE.stops,
  ...demoPlaces.filter((place) => !ART_AND_COFFEE_ROUTE.stops.some((stop) => stop.id === place.id)),
];

function toPace(tempo: Tempo | null): RoutePace {
  return tempo ?? 'medium';
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function scorePlace(
  place: Place,
  input: GenerateLocalRouteInput,
  cursor: { lat: number; lng: number },
) {
  let score = 0;
  const overlap = place.categories.filter((category) => input.interests.includes(category)).length;
  score += input.interests.length ? overlap * 24 : 10;
  if (input.interests.length && overlap === 0) score -= 7;

  if (input.draftPoeIds.includes(place.id)) score += 40;
  if (place.priceMin === 0 && place.priceMax === 0) score += 3;
  if (place.accessibility.includes('ramps')) score += input.accessibility.includes('ramps') ? 8 : 0;
  if (place.accessibility.includes('avoid_stairs')) {
    score += input.accessibility.includes('avoid_stairs') ? 8 : 0;
  }
  if (input.accessibility.includes('hearing') && isNoisyPlace(place)) score -= 40;

  score -= distanceMeters(cursor, place) / 650;
  return score;
}

function passesHardFilters(place: Place, input: GenerateLocalRouteInput) {
  if (input.budgetMax != null && place.priceMin != null && place.priceMin > input.budgetMax) {
    return false;
  }
  if (input.budgetMin != null && place.priceMax != null && place.priceMax < input.budgetMin) {
    return false;
  }
  if (
    input.accessibility.includes('wheelchair') &&
    !place.accessibility.includes('wheelchair')
  ) {
    return false;
  }
  if (input.accessibility.includes('ramps') && !place.accessibility.includes('ramps')) {
    return false;
  }
  if (
    input.accessibility.includes('avoid_stairs') &&
    !place.accessibility.includes('avoid_stairs')
  ) {
    return false;
  }
  if (input.accessibility.includes('hearing') && isNoisyPlace(place)) {
    return false;
  }
  return true;
}

function uniquePlaces(places: Place[]) {
  const byId = new Map<string, Place>();
  for (const place of places) byId.set(place.id, place);
  return [...byId.values()];
}

function routeTitle(interests: InterestId[], selected: Place[]) {
  const chosen = interests.filter((interest) =>
    selected.some((place) => place.categories.includes(interest)),
  );
  if (chosen.includes('art') && chosen.includes('coffee')) return 'Искусство и кофе';
  if (chosen.length) {
    const [first, second] = chosen;
    return second
      ? `${INTEREST_TITLES[first]} и ${INTEREST_TITLES[second]}`
      : INTEREST_TITLES[first];
  }
  return 'Маршрут рядом с вами';
}

export function generateLocalRoute(input: GenerateLocalRouteInput): RouteGeneratedPublic {
  const start = input.startLocation ?? {
    ...EKATERINBURG_CENTER,
    address: 'Екатеринбург, центр',
  };
  const pace = toPace(input.tempo);
  const targetMinutes = Math.max(
    60,
    Math.round(
      ((input.durationMinHours ?? 1) + (input.durationMaxHours ?? input.durationMinHours ?? 2)) *
        30,
    ),
  );
  const maxStopMinutes = Math.max(40, targetMinutes - 30);
  // Используем строго те POI, которые пришли из бэкенда. Раньше сюда
  // подмешивались FALLBACK_PLACES (Plan ART, Simple Coffee, Плотинка,
  // Ельцин Центр и т.д.) — из-за этого в маршрутах появлялись «несуществующие»
  // точки, которых нет в админке. Fallback оставляем только на самый крайний
  // случай — когда из бэкенда вообще ничего не пришло (демо-режим без сети).
  const source = uniquePlaces(
    input.places.length ? input.places : FALLBACK_PLACES,
  );
  const hardFiltered = source.filter((place) => passesHardFilters(place, input));
  if (!hardFiltered.length) {
    throw new Error('Не нашлось мест, которые подходят под выбранные ограничения доступности');
  }
  const candidates = hardFiltered;
  const selected: Place[] = [];
  let cursor = start;
  let stopMinutes = 0;

  while (selected.length < 4 && stopMinutes < maxStopMinutes) {
    const next = candidates
      .filter((place) => !selected.some((selectedPlace) => selectedPlace.id === place.id))
      .sort((a, b) => scorePlace(b, input, cursor) - scorePlace(a, input, cursor))[0];
    if (!next) break;

    const nextStopMinutes = Math.max(30, Math.round(next.durationHours * 60));
    if (selected.length >= 2 && stopMinutes + nextStopMinutes > maxStopMinutes) break;

    selected.push(next);
    stopMinutes += nextStopMinutes;
    cursor = next;
  }

  const selectedPlaces = selected.length
    ? selected
    : input.places.length
      ? input.places.slice(0, 2)
      : FALLBACK_PLACES.slice(0, 2);
  const path = [start, ...selectedPlaces];
  const distance = path.slice(1).reduce((sum, point, index) => {
    return sum + distanceMeters(path[index], point);
  }, 0);
  const walkMinutes = Math.round(distance / ROUTE_SPEED_METERS_PER_MINUTE[pace]);
  const durationMinutes = Math.max(60, stopMinutes + walkMinutes);
  const accessibleCount = selectedPlaces.filter(
    (place) =>
      place.accessibility.includes('wheelchair') ||
      place.accessibility.includes('avoid_stairs') ||
      place.accessibility.includes('ramps'),
  ).length;

  return {
    id: `local-route-${Date.now()}`,
    title: routeTitle(input.interests, selectedPlaces),
    description:
      'Маршрут собран по вашим интересам, ограничениям доступности, бюджету и времени.',
    city_id: 'ekb',
    status: 'saved',
    source: 'generated',
    duration_minutes: durationMinutes,
    distance_meters: Math.round(distance),
    pace,
    points: selectedPlaces.map((place, index) => ({
      order: index + 1,
      poe_id: place.id,
      planned_stop_minutes: Math.max(30, Math.round(place.durationHours * 60)),
    })),
    accessibility_score: Math.round((accessibleCount / selectedPlaces.length) * 100),
  };
}

export function generateScenarioRoute(
  scenarioId: string,
  startLocation?: { lat: number; lng: number; address?: string | null },
): RouteGeneratedPublic {
  const scenario = ROUTE_SCENARIOS.find((item) => item.id === scenarioId);
  if (!scenario) {
    throw new Error('Сценарий маршрута не найден');
  }

  const start = startLocation ?? {
    ...EKATERINBURG_CENTER,
    address: 'Екатеринбург, центр',
  };
  const path = [start, ...scenario.stops];
  const distance = path.slice(1).reduce((sum, point, index) => {
    return sum + distanceMeters(path[index], point);
  }, 0);
  const walkMinutes = Math.round(distance / ROUTE_SPEED_METERS_PER_MINUTE[scenario.pace]);

  return {
    id: `scenario-route-${scenario.id}-${Date.now()}`,
    title: scenario.title,
    description: scenario.description,
    city_id: 'ekb',
    status: 'saved',
    source: 'generated',
    duration_minutes: Math.max(scenario.durationMinutes, scenario.durationMinutes + walkMinutes),
    distance_meters: Math.round(distance),
    pace: scenario.pace,
    points: scenario.stops.map((place, index) => ({
      order: index + 1,
      poe_id: place.id,
      planned_stop_minutes: place.stopMinutes,
    })),
    accessibility_score: 92,
  };
}

export function getLocalRoutePlaces(backendPlaces: Place[]) {
  // Если бэкенд вернул POI — пользуемся только ими. FALLBACK_PLACES (Plan ART
  // и т.п.) — это аварийный демо-набор для оффлайна, чтобы у генератора было
  // хоть из чего собрать маршрут. Подмешивать их к реальным точкам нельзя:
  // иначе на карте/в маршруте появляются точки, которых нет в админке.
  if (backendPlaces.length) return uniquePlaces(backendPlaces);
  return uniquePlaces(FALLBACK_PLACES);
}

export function getLocalRoutePlace(id: string) {
  return FALLBACK_PLACES.find((place) => place.id === id);
}

export function getLocalRoutePoeDetail(id: string): PoeDetail | undefined {
  const place = getLocalRoutePlace(id);
  if (!place) return undefined;

  return {
    id: place.id,
    title: place.name,
    description: place.description,
    category: place.categories[0] ?? 'relax',
    tags: place.categories,
    location: {
      lat: place.lat,
      lng: place.lng,
      address: place.address,
    },
    accessibility: {
      wheelchair_accessible: place.accessibility.includes('wheelchair'),
      has_ramp: place.accessibility.includes('ramps'),
      has_stairs: !place.accessibility.includes('avoid_stairs'),
    },
    rating: 4.8,
    reviews_count: 24,
    duration_minutes: place.durationHours * 60,
    images: [],
    opening_hours: [{ day: 'mon-sun', from: '10:00', to: '21:00' }],
  };
}
