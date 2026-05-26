import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchTourSlots, fetchTours } from './api';
import {
  formatHoursRu,
  formatTourCardSchedule,
  pickUpcomingSlot,
} from './formatSchedule';
import type { TourPublic } from './types';

export type NearbyTourItem = {
  tour: TourPublic;
  schedule: string;
  distanceMeters: number;
};

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadius = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

export function useNearbyTours(
  center: { lat: number; lng: number },
  limit = 2,
) {
  const toursQuery = useQuery({
    queryKey: ['tours', 'list', 'nearby', { city_id: 'ekb' }],
    queryFn: () => fetchTours({ city_id: 'ekb', page: 1, limit: 24 }),
    staleTime: 60_000,
  });

  const tours = toursQuery.data?.data ?? [];

  const slotQueries = useQueries({
    queries: tours.map((tour) => ({
      queryKey: ['tours', 'slots', tour.id, 'nearby'],
      queryFn: () => fetchTourSlots(tour.id),
      enabled: Boolean(tour.id),
      staleTime: 60_000,
    })),
  });

  const items = useMemo((): NearbyTourItem[] => {
    const enriched = tours.map((tour, index) => {
      const slot = pickUpcomingSlot(slotQueries[index]?.data);
      const schedule = slot
        ? formatTourCardSchedule(slot.starts_at, tour.duration_minutes)
        : `${formatHoursRu(Math.max(1, Math.round(tour.duration_minutes / 60)))} · дата уточняется`;

      return {
        tour,
        schedule,
        distanceMeters: distanceMeters(center, tour.meeting_point),
        nextSlotAt: slot?.starts_at ?? null,
      };
    });

    return enriched
      .sort((a, b) => {
        if (a.nextSlotAt && b.nextSlotAt) {
          return (
            new Date(a.nextSlotAt).getTime() - new Date(b.nextSlotAt).getTime()
          );
        }
        if (a.nextSlotAt) return -1;
        if (b.nextSlotAt) return 1;
        return a.distanceMeters - b.distanceMeters;
      })
      .slice(0, limit)
      .map(({ tour, schedule, distanceMeters: distance }) => ({
        tour,
        schedule,
        distanceMeters: distance,
      }));
  }, [center.lat, center.lng, limit, slotQueries, tours]);

  const slotsLoading = slotQueries.some((query) => query.isLoading);

  return {
    items,
    isLoading: toursQuery.isLoading || (tours.length > 0 && slotsLoading),
    isError: toursQuery.isError,
  };
}
