export type ReviewEntityType = 'tour' | 'poe';

export type ReviewPublic = {
  id: string;
  user: { id: string; name: string };
  rating: number;
  text: string;
  created_at: string;
  entity_type?: ReviewEntityType | null;
  entity_id?: string | null;
  entity_title?: string | null;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ReviewsListResponse = {
  data: ReviewPublic[];
  meta: PaginationMeta;
  error: null;
};
