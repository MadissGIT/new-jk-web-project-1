export type RoutePace = 'slow' | 'medium' | 'fast';

export type RouteGenerateRequest = {
  city_id: string;
  interests: string[];
  start_location: {
    lat: number;
    lng: number;
    address?: string | null;
  };
  duration_minutes: number;
  pace: RoutePace;
  budget_level: string;
  accessibility: {
    wheelchair_required: boolean;
    avoid_stairs: boolean;
    need_rest_points: boolean;
    requires_ramp?: boolean;
    audio_preferred?: boolean;
  };
};

export type RoutePointPublic = {
  order: number;
  poe_id: string;
  planned_stop_minutes: number;
  title?: string;
  category?: string;
};

export type RouteStatus = 'draft' | 'saved' | 'in_progress' | 'completed' | 'archived';

export type RouteSource = 'generated' | 'manual';

export type RouteGeneratedPublic = {
  id: string;
  title: string;
  description: string;
  city_id: string;
  status: RouteStatus;
  source: RouteSource;
  duration_minutes: number;
  distance_meters: number;
  pace: RoutePace;
  points: RoutePointPublic[];
  accessibility_score: number;
};

export type RouteListItemPublic = {
  id: string;
  title: string;
  status: RouteStatus;
  source: RouteSource;
  duration_minutes: number;
  distance_meters: number;
  created_at: string;
};

export type RoutePoeShort = {
  id: string;
  title: string;
  category: string;
};

export type RoutePointDetailPublic = {
  order: number;
  poe: RoutePoeShort;
  planned_stop_minutes: number;
};

export type RouteDetailPublic = Omit<RouteGeneratedPublic, 'points'> & {
  start_point: {
    lat: number;
    lng: number;
    address?: string | null;
  };
  points: RoutePointDetailPublic[];
  created_at: string;
};

export type RouteSavedPublic = {
  id: string;
  status: RouteStatus;
};

export type RouteJourneyPublic = {
  id: string;
  status: RouteStatus;
  progress_order: number;
  started_at: string | null;
  completed_at: string | null;
};

export type RouteProgressUpdate = {
  order: number;
};

export type ListResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error: null;
};

export type DetailResponse<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: null;
};
