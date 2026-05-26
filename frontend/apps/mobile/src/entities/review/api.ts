import { http } from '../../shared/api/http';
import type { ReviewsListResponse } from './types';

export async function fetchMyReviews(params?: {
  page?: number;
  limit?: number;
  entity_type?: 'tour' | 'poe';
}) {
  const { data } = await http.get<ReviewsListResponse>('/reviews/me', { params });
  return data;
}

export async function deleteMyReview(reviewId: string) {
  const { data } = await http.delete<{ data: { deleted: string } }>(
    `/reviews/me/${reviewId}`,
  );
  return data.data;
}
