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

export type Price = {
  amount: number;
  currency: string;
};

export type TourAccessibility = {
  wheelchair_accessible: boolean;
  avoid_stairs_possible: boolean;
};

export type TourStatus = 'draft' | 'moderation' | 'published' | 'hidden' | 'rejected';

export type GuidePublic = {
  id: string;
  name: string;
  rating: number;
  reviews_count: number;
};

export type TourPublic = {
  id: string;
  title: string;
  short_description: string;
  city_id: string;
  format: string;
  language: string;
  duration_minutes: number;
  group_size_max: number;
  status: TourStatus;
  price: Price;
  guide: GuidePublic;
  rating: number;
  reviews_count: number;
  cover_image_url: string | null;
  images?: string[];
  tags: string[];
  meeting_point: { lat: number; lng: number; address?: string | null };
  accessibility: TourAccessibility;
};

export type TourFormat =
  | 'offline_guided'
  | 'self_guided'
  | 'audio_guide'
  | 'private_tour'
  | 'group_tour';

export type TourCreatePayload = {
  title: string;
  description: string;
  city_id: string;
  guide_id?: string | null;
  guide_name?: string | null;
  guide_avatar_url?: string | null;
  guide_rating?: number;
  guide_reviews_count?: number;
  guide_bio?: string | null;
  format: TourFormat;
  language?: string;
  duration_minutes: number;
  group_size_max?: number;
  price_amount: number;
  price_currency?: string;
  tags?: string[];
  meeting_lat: number;
  meeting_lng: number;
  meeting_address?: string | null;
  wheelchair_accessible?: boolean;
  avoid_stairs_possible?: boolean;
  rating?: number;
  reviews_count?: number;
  cover_image_url?: string | null;
  images?: string[];
  cancellation_policy?: string;
  route_distance_meters?: number;
  route_points_count?: number;
};

export type TourDetail = {
  id: string;
  title: string;
  description: string;
  city_id: string;
  rating: number;
  reviews_count: number;
  guide: GuidePublic & { avatar_url?: string | null; bio?: string | null };
  format: string;
  language: string;
  duration_minutes: number;
  status: TourStatus;
  group_size_max: number;
  price: Price;
  tags: string[];
  cover_image_url?: string | null;
  meeting_point: { lat: number; lng: number; address?: string | null };
  route_preview: { distance_meters: number; points_count: number };
  accessibility: TourAccessibility;
  images: string[];
  cancellation_policy: string;
};

export type TourReviewPublic = {
  id: string;
  tour_id: string;
  booking_id: string;
  user_id: string;
  rating: number;
  text: string;
  created_at: string;
  accessibility_rating?: number | null;
};

export type TourSlotPublic = {
  id: string;
  starts_at: string;
  ends_at: string;
  available_capacity: number;
  price: Price;
  status: 'available' | 'sold_out' | 'cancelled';
};

export type TourSlotCreatePayload = {
  starts_at: string;
  ends_at: string;
  available_capacity: number;
  price: Price;
  status?: TourSlotPublic['status'];
};

export type BookingCreatePayload = {
  tour_id: string;
  slot_id: string;
  participants_count: number;
  contact_phone?: string;
  comment?: string;
  idempotency_key?: string;
};

export type BookingCreatedPublic = {
  id: string;
  tour_id: string;
  slot_id: string;
  participants_count: number;
  status: string;
  price_total: Price;
  payment: {
    payment_id: string;
    payment_url: string;
  };
  created_at: string;
};

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'refunded';

export type BookingPublic = {
  id: string;
  tour: {
    id: string;
    title: string;
  };
  slot: {
    id: string;
    starts_at: string;
  };
  participants_count: number;
  status: BookingStatus;
  refund_status?: 'not_required' | 'pending' | 'refunded';
  price_total: Price;
  contact_phone?: string | null;
  comment?: string | null;
};

export type GuideBookingPublic = BookingPublic & {
  customer_name: string;
};

export type TourSlotUpdatePayload = {
  starts_at?: string;
  ends_at?: string;
  available_capacity?: number;
  price?: Price;
  status?: TourSlotPublic['status'];
};

export type BookingDetail = BookingPublic & {
  slot: {
    id: string;
    starts_at: string;
    ends_at?: string | null;
  };
  meeting_point: Record<string, string | null>;
};

export type BookingCancelledPublic = {
  id: string;
  status: BookingStatus;
  refund_status: 'not_required' | 'pending' | 'refunded';
};

export type MockPaymentPublic = {
  booking_id: string;
  payment_id: string;
  status: BookingStatus;
};
