import { isAxiosError } from 'axios';

import type { GuideApplicationPayload } from './guideModeStore';
import type {
  BookingCancelledPublic,
  BookingDetail,
  GuideBookingPublic,
  ListResponse as ApiListResponse,
} from '../tour/types';
import { http } from '../../shared/api/http';

export type ServerGuideApplicationStatus = 'pending' | 'approved' | 'rejected';

export type ServerGuideApplication = {
  id: string;
  user_id: string;
  payload: GuideApplicationPayload;
  status: ServerGuideApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type DetailResponse<T> = {
  data: T;
};

export async function applyForGuide(payload: GuideApplicationPayload) {
  const response = await http.post<DetailResponse<ServerGuideApplication>>('/guides/apply', {
    payload,
  });
  return response.data.data;
}

export async function fetchLatestGuideApplication() {
  try {
    const response = await http.get<DetailResponse<ServerGuideApplication>>(
      '/guides/applications/me/latest',
    );
    return response.data.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export type GuideTourBrief = {
  id: string;
  title: string;
  cover_image_url: string | null;
  rating: number;
  reviews_count: number;
};

export type GuidePublicProfile = {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  contacts: string | null;
  bio: string;
  specialization: string;
  languages: string[];
  experience: number;
  avatar: string | null;
  rating: number;
  reviews_count: number;
  tours_count: number;
  tours: GuideTourBrief[];
};

export async function fetchGuidePublicProfile(guideId: string) {
  const response = await http.get<DetailResponse<GuidePublicProfile>>(`/guides/${guideId}`);
  return response.data.data;
}

export type GuideOwnProfile = {
  user_id: string;
  bio: string;
  specialization: string;
  languages: string[];
  experience: number;
  avatar: string | null;
};

export type GuideProfileUpdateInput = {
  bio: string;
  specialization: string;
  languages: string[];
  experience: number;
  avatar?: string | null;
  display_name?: string;
  contacts?: string;
};

export async function fetchMyGuideProfile() {
  const response = await http.get<DetailResponse<GuideOwnProfile>>('/guides/me');
  return response.data.data;
}

export async function updateMyGuideProfile(body: GuideProfileUpdateInput) {
  const response = await http.patch<DetailResponse<GuideOwnProfile>>('/guides/me', body);
  return response.data.data;
}

export type GuideReviewPublic = {
  id: string;
  user: { id: string; name: string };
  rating: number;
  text: string;
  created_at: string;
};

export async function fetchGuideReviews(params?: { page?: number; limit?: number }) {
  const response = await http.get<ApiListResponse<GuideReviewPublic>>('/guides/me/reviews', {
    params,
  });
  return response.data;
}

export type GuideStats = {
  tours_count: number;
  bookings_count: number;
  avg_rating: number;
  top_tours: Array<{
    id: string;
    title: string;
    bookings_count: number;
    rating: number;
  }>;
};

export async function fetchGuideStats() {
  const response = await http.get<{ data: GuideStats }>('/guides/me/stats');
  return response.data.data;
}

export async function fetchGuideBookings(params?: {
  page?: number;
  limit?: number;
  status?: string;
  tour_id?: string;
  date_from?: string;
  date_to?: string;
}) {
  const response = await http.get<ApiListResponse<GuideBookingPublic>>('/guides/me/bookings', {
    params,
  });
  return response.data;
}

export async function confirmGuideBooking(bookingId: string) {
  const response = await http.post<{ data: BookingDetail }>(
    `/guides/me/bookings/${bookingId}/confirm`,
  );
  return response.data.data;
}

export async function cancelGuideBooking(bookingId: string) {
  const response = await http.post<{ data: BookingCancelledPublic }>(
    `/guides/me/bookings/${bookingId}/cancel`,
  );
  return response.data.data;
}
