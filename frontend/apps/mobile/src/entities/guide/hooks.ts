import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelGuideBooking,
  confirmGuideBooking,
  fetchGuideBookings,
  fetchGuidePublicProfile,
  fetchGuideReviews,
  fetchGuideStats,
  fetchMyGuideProfile,
  updateMyGuideProfile,
  type GuideProfileUpdateInput,
} from './api';
import { useAuthStore } from '../auth/authStore';

export function useGuidePublicProfile(guideId: string | null) {
  return useQuery({
    queryKey: ['guides', 'public', guideId],
    queryFn: () => fetchGuidePublicProfile(guideId as string),
    enabled: Boolean(guideId),
    staleTime: 60_000,
  });
}

export function useMyGuideProfile(enabled = true) {
  return useQuery({
    queryKey: ['guides', 'me', 'profile'],
    queryFn: fetchMyGuideProfile,
    enabled,
    staleTime: 30_000,
  });
}

export function useGuideReviews(enabled = true) {
  return useQuery({
    queryKey: ['guides', 'me', 'reviews'],
    queryFn: () => fetchGuideReviews({ page: 1, limit: 100 }),
    enabled,
    staleTime: 30_000,
  });
}

export function useGuideStats(enabled = true) {
  return useQuery({
    queryKey: ['guides', 'me', 'stats'],
    queryFn: fetchGuideStats,
    enabled,
    staleTime: 30_000,
  });
}

export function useGuideBookings(
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    tour_id?: string;
    date_from?: string;
    date_to?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: ['guides', 'me', 'bookings', params],
    queryFn: () => fetchGuideBookings({ page: 1, limit: 100, ...params }),
    enabled,
    staleTime: 20_000,
  });
}

export function useConfirmGuideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => confirmGuideBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guides', 'me', 'bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['guides', 'me', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['tours', 'slots'] });
    },
  });
}

export function useCancelGuideBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => cancelGuideBooking(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guides', 'me', 'bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['guides', 'me', 'stats'] });
      void queryClient.invalidateQueries({ queryKey: ['tours', 'slots'] });
    },
  });
}

export function useUpdateMyGuideProfile() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: (body: GuideProfileUpdateInput) => updateMyGuideProfile(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['guides', 'me', 'profile'] });
      void queryClient.invalidateQueries({ queryKey: ['guide-application', 'me', 'latest'] });
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ['guides', 'public', userId] });
      }
    },
  });
}
