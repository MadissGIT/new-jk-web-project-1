import type { Place } from '../place/types';
import type { PoeDetail } from '../poe/types';

export type ReadyRouteStop = Place & {
  order: number;
  image: string;
  rating: number;
  reviewsCount: number;
  website?: string;
  phone?: string;
  hoursLabel?: string;
};

export type ReadyRoute = {
  id: string;
  title: string;
  status: 'active' | 'planned';
  distanceKm: number;
  durationLabel: string;
  moodLabel: string;
  stops: ReadyRouteStop[];
};

export const CURRENT_LOCATION_FALLBACK = {
  lat: 56.8377,
  lng: 60.6074,
  address: 'Текущее местоположение',
} as const;

// В шторке «Готовые маршруты» оставляем одну запись — «Прогулка: искусство и
// кофе». При нажатии «Продолжить» она запускает реальную генерацию маршрута
// по предпочтениям пользователя через useRouteBuilder, а её stops/image
// используются только как fallback для блока «Популярные» на карте.
export const READY_ROUTES: ReadyRoute[] = [
  {
    id: 'art-and-coffee',
    title: 'Прогулка: искусство и кофе',
    status: 'active',
    distanceKm: 3.2,
    durationLabel: '2 часа',
    moodLabel: 'искусство и кофе',
    stops: [
      {
        id: 'plan-art-gallery',
        order: 1,
        name: 'Галерея Plan ART',
        description:
          'Художественная галерея и выставочный центр в Ельцин Центре. Подходит для спокойной прогулки с современным искусством.',
        categories: ['art', 'history'],
        priceMin: 0,
        priceMax: 400,
        durationHours: 1,
        lat: 56.8441,
        lng: 60.5891,
        address: 'ул. Бориса Ельцина, 3',
        accessibility: ['wheelchair', 'ramps', 'avoid_stairs'],
        image: 'https://picsum.photos/seed/plan-art-gallery/900/600',
        rating: 4.9,
        reviewsCount: 120,
        website: 'yeltsin.ru',
        phone: '+7 (343) 312-43-20',
        hoursLabel: 'вт-вс, 10:00-21:00',
      },
      {
        id: 'simple-coffee-krasnoarmeiskaya',
        order: 2,
        name: 'Кофейня Simple Coffee',
        description:
          'Уютная кофейня Simple Coffee в центре Екатеринбурга рядом с оперным театром. Хорошее место, чтобы завершить прогулку кофе и десертом.',
        categories: ['coffee', 'relax'],
        priceMin: 220,
        priceMax: 700,
        durationHours: 1,
        lat: 56.8395,
        lng: 60.6217,
        address: 'Красноармейская ул., 2, этаж 1',
        accessibility: ['wheelchair', 'avoid_stairs'],
        image: 'https://picsum.photos/seed/simple-coffee-ekb/900/600',
        rating: 4.7,
        reviewsCount: 32,
        website: 'simplecoffee.ru',
        phone: '+7 (904) 164-73-54',
        hoursLabel: 'ежедневно, 08:00-23:00',
      },
    ],
  },
];

export const ART_AND_COFFEE_ROUTE = READY_ROUTES[0];

export function getReadyRouteStop(id: string): ReadyRouteStop | undefined {
  return READY_ROUTES.flatMap((route) => route.stops).find((stop) => stop.id === id);
}

export function getReadyRoutePoeDetail(id: string): PoeDetail | undefined {
  const stop = getReadyRouteStop(id);
  if (!stop) return undefined;

  return {
    id: stop.id,
    title: stop.name,
    description: stop.description,
    category: stop.categories[0] ?? 'relax',
    tags: stop.categories,
    location: {
      lat: stop.lat,
      lng: stop.lng,
      address: stop.address,
    },
    accessibility: {
      wheelchair_accessible: stop.accessibility.includes('wheelchair'),
      has_ramp: stop.accessibility.includes('ramps'),
      has_stairs: !stop.accessibility.includes('avoid_stairs'),
    },
    rating: stop.rating,
    reviews_count: stop.reviewsCount,
    duration_minutes: stop.durationHours * 60,
    images: [stop.image],
    opening_hours: [{ day: 'mon-sun', from: '08:00', to: '23:00' }],
  };
}
