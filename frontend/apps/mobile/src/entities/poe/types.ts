export type PoeAccessibility = {
  wheelchair_accessible: boolean;
  has_ramp: boolean;
  has_stairs: boolean;
};

export type PoeLocation = {
  lat: number;
  lng: number;
  address: string | null;
};

export type PoePublic = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  location: PoeLocation;
  accessibility: PoeAccessibility;
  rating: number;
  reviews_count: number;
  duration_minutes: number;
  images: string[];
};

export type PoeDetail = PoePublic & {
  opening_hours: { day: string; from: string; to: string }[];
};

export type PoeReviewCreate = {
  rating: number;
  text: string;
  accessibility_rating?: number | null;
};

export type ReviewUserPublic = {
  id: string;
  name: string;
};

export type ReviewPublic = {
  id: string;
  user: ReviewUserPublic;
  rating: number;
  text: string;
  created_at: string;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: PaginationMeta;
  error: null;
};

export type DetailResponse<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: null;
};

export type PoeQuery = {
  city_id?: string;
  category?: string;
  tags?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  wheelchair_accessible?: boolean;
  avoid_stairs?: boolean;
  page?: number;
  limit?: number;
};
