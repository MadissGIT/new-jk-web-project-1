import { http } from '../../shared/api/http';
import type {
  DetailResponse,
  ListResponse,
  RouteDetailPublic,
  RouteGenerateRequest,
  RouteGeneratedPublic,
  RouteJourneyPublic,
  RouteListItemPublic,
  RouteProgressUpdate,
  RouteSavedPublic,
  RouteStatus,
} from './types';

function normalizeRouteDetail(route: RouteDetailPublic): RouteGeneratedPublic {
  return {
    id: route.id,
    title: route.title,
    description: route.description,
    city_id: route.city_id,
    status: route.status,
    source: route.source,
    duration_minutes: route.duration_minutes,
    distance_meters: route.distance_meters,
    pace: route.pace,
    points: route.points.map((point) => ({
      order: point.order,
      poe_id: point.poe.id,
      planned_stop_minutes: point.planned_stop_minutes,
      title: point.poe.title,
      category: point.poe.category,
    })),
    accessibility_score: route.accessibility_score,
  };
}

export async function generateRoute(payload: RouteGenerateRequest) {
  const endpoints = ['/routes/generate', '/routes/generate/', '/route/generate'];
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const { data } = await http.post<DetailResponse<RouteGeneratedPublic>>(endpoint, payload);
      return data.data;
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      // Business 404 from generator (e.g. no POE candidates) should be surfaced as-is.
      if (status === 404 && typeof detail === 'string' && detail !== 'Not Found') {
        throw error;
      }
      // If endpoint exists but request fails for business/validation/auth reasons,
      // stop retries immediately and surface the real backend error.
      if (status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
}

export async function fetchRoutes(params?: {
  page?: number;
  limit?: number;
  status?: RouteStatus;
}) {
  const { data } = await http.get<ListResponse<RouteListItemPublic>>('/routes/history', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      status: params?.status,
    },
  });
  return data;
}

export async function fetchRoute(routeId: string) {
  const { data } = await http.get<DetailResponse<RouteDetailPublic>>(`/routes/${routeId}`);
  return normalizeRouteDetail(data.data);
}

export async function saveRoute(routeId: string) {
  const { data } = await http.post<DetailResponse<RouteSavedPublic>>(`/routes/${routeId}/save`);
  return data.data;
}

export async function startRoute(routeId: string) {
  const { data } = await http.post<DetailResponse<RouteJourneyPublic>>(`/routes/${routeId}/start`);
  return data.data;
}

export async function updateRouteProgress(routeId: string, payload: RouteProgressUpdate) {
  const { data } = await http.post<DetailResponse<RouteJourneyPublic>>(
    `/routes/${routeId}/progress`,
    payload,
  );
  return data.data;
}

export async function finishRoute(routeId: string) {
  const { data } = await http.post<DetailResponse<RouteJourneyPublic>>(`/routes/${routeId}/finish`);
  return data.data;
}
