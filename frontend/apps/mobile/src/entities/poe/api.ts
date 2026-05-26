import { http } from '../../shared/api/http';
import type {
  DetailResponse,
  ListResponse,
  PoeDetail,
  PoePublic,
  PoeQuery,
  PoeReviewCreate,
  ReviewPublic,
} from './types';

export async function fetchPoes(query: PoeQuery): Promise<ListResponse<PoePublic>> {
  const { data } = await http.get<ListResponse<PoePublic>>('/poe', { params: query });
  return data;
}

export async function fetchPoeDetail(poeId: string): Promise<PoeDetail> {
  const { data } = await http.get<DetailResponse<PoeDetail>>(`/poe/${poeId}`);
  return data.data;
}

export async function fetchPoeReviews(
  poeId: string,
  query: { page?: number; limit?: number } = {},
): Promise<ListResponse<ReviewPublic>> {
  const { data } = await http.get<ListResponse<ReviewPublic>>(
    `/poes/${poeId}/reviews`,
    { params: query },
  );
  return data;
}

export async function createPoeReview(poeId: string, payload: PoeReviewCreate) {
  const { data } = await http.post(`/poes/${poeId}/reviews`, payload);
  return data;
}
