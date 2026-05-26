import { http } from '../../shared/api/http';
import type {
  BookingCancelledPublic,
  BookingCreatePayload,
  BookingCreatedPublic,
  BookingDetail,
  BookingPublic,
  DetailResponse,
  ListResponse,
  MockPaymentPublic,
  TourCreatePayload,
  TourDetail,
  TourReviewPublic,
  TourPublic,
  TourSlotCreatePayload,
  TourSlotPublic,
  TourSlotUpdatePayload,
} from './types';

export async function fetchTours(params?: Record<string, unknown>) {
  const { data } = await http.get<ListResponse<TourPublic>>('/tours', { params });
  return data;
}

export async function fetchMyTours(params?: Record<string, unknown>) {
  const { data } = await http.get<ListResponse<TourPublic>>('/tours/me', { params });
  return data;
}

export async function fetchTour(tourId: string) {
  const { data } = await http.get<DetailResponse<TourDetail>>(`/tours/${tourId}`);
  return data.data;
}

export async function createTour(payload: TourCreatePayload) {
  const { data } = await http.post<DetailResponse<TourDetail>>('/tours', payload);
  return data.data;
}

export async function fetchTourSlots(tourId: string) {
  const { data } = await http.get<DetailResponse<TourSlotPublic[]>>(
    `/tours/${tourId}/slots`,
  );
  return data.data;
}

export async function createTourSlot(tourId: string, payload: TourSlotCreatePayload) {
  const { data } = await http.post<DetailResponse<TourSlotPublic>>(
    `/tours/${tourId}/slots`,
    payload,
  );
  return data.data;
}

export async function updateTourSlot(
  tourId: string,
  slotId: string,
  payload: TourSlotUpdatePayload,
) {
  const { data } = await http.patch<DetailResponse<TourSlotPublic>>(
    `/tours/${tourId}/slots/${slotId}`,
    payload,
  );
  return data.data;
}

export async function closeTourSlot(tourId: string, slotId: string) {
  const { data } = await http.post<DetailResponse<TourSlotPublic>>(
    `/tours/${tourId}/slots/${slotId}/close`,
  );
  return data.data;
}

export async function createBooking(payload: BookingCreatePayload) {
  const { data } = await http.post<DetailResponse<BookingCreatedPublic>>(
    '/bookings',
    payload,
  );
  return data.data;
}

export async function fetchBookings(params?: { status?: string; page?: number; limit?: number }) {
  const { data } = await http.get<ListResponse<BookingPublic>>('/bookings', { params });
  return data;
}

export async function fetchBookingDetail(bookingId: string) {
  const { data } = await http.get<DetailResponse<BookingDetail>>(`/bookings/${bookingId}`);
  return data.data;
}

export async function cancelBooking(bookingId: string, reason?: string) {
  const { data } = await http.post<DetailResponse<BookingCancelledPublic>>(
    `/bookings/${bookingId}/cancel`,
    { reason: reason ?? null },
  );
  return data.data;
}

export async function confirmMockPayment(bookingId: string) {
  const { data } = await http.post<DetailResponse<MockPaymentPublic>>(
    `/bookings/${bookingId}/mock-payment/confirm`,
  );
  return data.data;
}

export async function refundMockPayment(bookingId: string) {
  const { data } = await http.post<DetailResponse<MockPaymentPublic>>(
    `/bookings/${bookingId}/mock-payment/refund`,
  );
  return data.data;
}

export async function createTourReview(
  tourId: string,
  payload: { rating: number; text: string; booking_id: string; accessibility_rating?: number },
) {
  const { data } = await http.post<DetailResponse<TourReviewPublic>>(`/tours/${tourId}/reviews`, payload);
  return data.data;
}

export async function fetchTourReviews(tourId: string) {
  const { data } = await http.get<ListResponse<TourReviewPublic>>(`/tours/${tourId}/reviews`);
  return data;
}

export async function updateTourStatus(tourId: string, status: TourPublic['status']) {
  const { data } = await http.patch<DetailResponse<TourDetail>>(`/tours/${tourId}/status`, {
    status,
  });
  return data.data;
}
