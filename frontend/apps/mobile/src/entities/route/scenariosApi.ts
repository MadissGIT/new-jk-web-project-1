import { useQuery } from '@tanstack/react-query';

import { http } from '../../shared/api/http';
import type { ListResponse, RoutePace } from './types';

export type RouteScenarioAccessibility = {
  wheelchair_required: boolean;
  avoid_stairs: boolean;
  need_rest_points: boolean;
  requires_ramp?: boolean;
  audio_preferred?: boolean;
};

export type RouteScenarioPublic = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  interests: string[];
  duration_minutes: number;
  pace: RoutePace;
  budget_level: string;
  accessibility: RouteScenarioAccessibility;
  sort_order: number;
};

export async function fetchRouteScenarios(): Promise<RouteScenarioPublic[]> {
  const { data } = await http.get<ListResponse<RouteScenarioPublic>>('/routes/scenarios');
  return data.data;
}

export function useRouteScenarios() {
  return useQuery({
    queryKey: ['routes', 'scenarios'],
    queryFn: fetchRouteScenarios,
    staleTime: 5 * 60_000,
  });
}
