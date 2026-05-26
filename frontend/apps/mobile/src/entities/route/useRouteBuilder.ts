import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { EKATERINBURG_CENTER } from '../place/places';
import { useAuthStore } from '../auth/authStore';
import { toBudgetLevel } from '../preferences/api';
import {
  usePreferencesStore,
  type AccessibilityId,
  type InterestId,
  type Tempo,
} from '../preferences/preferencesStore';
import { usePoes } from '../poe/hooks';
import { poeToPlace } from '../poe/mappers';
import { saveRoute } from './api';
import { useActiveRouteStore } from './activeRouteStore';
import { useGenerateRoute } from './hooks';
import {
  generateLocalRoute,
  getLocalRoutePlaces,
} from './localRouteGenerator';
import { useRouteDraftStore } from './routeDraftStore';
import { useRouteHistoryStore } from './routeHistoryStore';
import type { RouteScenarioPublic } from './scenariosApi';
import type { RoutePace } from './types';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';

type CurrentLocation = { lat: number; lng: number; address: string };

type BuildOverrides = {
  interests?: InterestId[];
  durationMinutes?: number;
  pace?: RoutePace;
  budgetLevel?: 'low' | 'medium' | 'high';
  accessibility?: {
    wheelchair_required?: boolean;
    avoid_stairs?: boolean;
    need_rest_points?: boolean;
    requires_ramp?: boolean;
    audio_preferred?: boolean;
  };
  /** Произвольное имя для уведомления/локальной заглушки. */
  title?: string;
};

const ALLOWED_INTERESTS: ReadonlyArray<InterestId> = [
  'art',
  'coffee',
  'history',
  'nature',
  'music',
  'relax',
];

function normalizeInterests(interests: string[] | undefined): InterestId[] {
  return (interests ?? []).filter(
    (interest): interest is InterestId =>
      ALLOWED_INTERESTS.includes(interest as InterestId),
  );
}

function accessibilityFromIds(ids: AccessibilityId[]) {
  return {
    wheelchair_required: ids.includes('wheelchair'),
    avoid_stairs: ids.includes('avoid_stairs'),
    need_rest_points: ids.includes('cane'),
    requires_ramp: ids.includes('ramps'),
    audio_preferred: ids.includes('hearing'),
  };
}

function durationFromPrefs(
  durationMinHours: number | null,
  durationMaxHours: number | null,
) {
  return Math.max(
    60,
    Math.round(
      ((durationMinHours ?? 1) + (durationMaxHours ?? durationMinHours ?? 2)) * 30,
    ),
  );
}

export function scenarioToOverrides(scenario: RouteScenarioPublic): BuildOverrides {
  return {
    interests: normalizeInterests(scenario.interests),
    durationMinutes: scenario.duration_minutes,
    pace: scenario.pace,
    budgetLevel:
      scenario.budget_level === 'low' || scenario.budget_level === 'high'
        ? scenario.budget_level
        : 'medium',
    accessibility: scenario.accessibility,
    title: scenario.title,
  };
}

/**
 * Хук-«построитель маршрута»: инкапсулирует geolocation, сборку запроса,
 * вызов /routes/generate и fallback на локальный генератор.
 *
 * Использование:
 *   const builder = useRouteBuilder();
 *   builder.build();                       // по preferences
 *   builder.build(scenarioToOverrides(s)); // по пресету сценария
 */
export function useRouteBuilder() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const interests = usePreferencesStore((s) => s.interests);
  const accessibility = usePreferencesStore((s) => s.accessibility);
  const tempo = usePreferencesStore((s) => s.tempo);
  const budgetMax = usePreferencesStore((s) => s.budgetMax);
  const budgetMin = usePreferencesStore((s) => s.budgetMin);
  const durationMinHours = usePreferencesStore((s) => s.durationMinHours);
  const durationMaxHours = usePreferencesStore((s) => s.durationMaxHours);

  const setActiveRoute = useActiveRouteStore((s) => s.setRoute);
  const addRouteToHistory = useRouteHistoryStore((s) => s.addRoute);
  const draftPoeIds = useRouteDraftStore((s) => s.poeIds);

  const poeCatalog = usePoes({ city_id: 'ekb', page: 1, limit: 100 });
  const generateRoute = useGenerateRoute();

  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation>({
    ...EKATERINBURG_CENTER,
    address: 'Екатеринбург, центр',
  });

  useEffect(() => {
    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation) return;
    geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const looksLikeEkaterinburg =
          latitude > 56.4 && latitude < 57.2 && longitude > 59.8 && longitude < 61.0;
        if (!looksLikeEkaterinburg) return;
        setCurrentLocation({
          lat: latitude,
          lng: longitude,
          address: 'Текущее местоположение',
        });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 3500, maximumAge: 120000 },
    );
  }, []);

  const sourcePlaces = useMemo(() => {
    const backendPlaces = (poeCatalog.data?.data ?? []).map(poeToPlace);
    return getLocalRoutePlaces(backendPlaces);
  }, [poeCatalog.data?.data]);

  const fallbackLocal = useCallback(
    (overrides: BuildOverrides, noticeMessage?: string) => {
      const draftTagSet = new Set<InterestId>();
      const selectedDraftPoes = sourcePlaces.filter((place) =>
        draftPoeIds.includes(place.id),
      );
      for (const poe of selectedDraftPoes) {
        for (const tag of poe.categories) {
          draftTagSet.add(tag as InterestId);
        }
      }

      const effectiveInterests = overrides.interests
        ? overrides.interests
        : Array.from(new Set([...interests, ...Array.from(draftTagSet)]));

      const route = generateLocalRoute({
        places: sourcePlaces,
        draftPoeIds,
        interests: effectiveInterests,
        accessibility,
        tempo: overrides.pace ?? tempo,
        budgetMin,
        budgetMax,
        durationMinHours: overrides.durationMinutes
          ? overrides.durationMinutes / 60
          : durationMinHours,
        durationMaxHours: overrides.durationMinutes
          ? overrides.durationMinutes / 60
          : durationMaxHours,
        startLocation: currentLocation,
      });
      const savedRoute = {
        ...route,
        title: overrides.title ?? route.title,
        status: 'saved' as const,
      };
      setActiveRoute(savedRoute);
      addRouteToHistory(savedRoute);
      if (noticeMessage) setNotice(noticeMessage);
      navigation.navigate('ActiveRoute');
    },
    [
      sourcePlaces,
      draftPoeIds,
      interests,
      accessibility,
      tempo,
      budgetMin,
      budgetMax,
      durationMinHours,
      durationMaxHours,
      currentLocation,
      setActiveRoute,
      addRouteToHistory,
      navigation,
    ],
  );

  const build = useCallback(
    async (overrides?: BuildOverrides) => {
      setError(null);
      setNotice(null);
      setIsBuilding(true);
      try {
        if (!token) {
          fallbackLocal(
            overrides ?? {},
            'Маршрут собран локально: войдите в аккаунт, чтобы сохранить его на сервере.',
          );
          return;
        }

        const requestInterests = overrides?.interests ?? interests;
        const durationMinutes =
          overrides?.durationMinutes ?? durationFromPrefs(durationMinHours, durationMaxHours);
        const pace: RoutePace = overrides?.pace ?? tempo ?? 'medium';
        const budgetLevel = overrides?.budgetLevel ?? toBudgetLevel(budgetMax);
        const accessibilityPayload = {
          ...accessibilityFromIds(accessibility),
          ...(overrides?.accessibility ?? {}),
        };

        const generated = await generateRoute.mutateAsync({
          city_id: 'ekb',
          interests: requestInterests,
          start_location: currentLocation,
          duration_minutes: durationMinutes,
          pace,
          budget_level: budgetLevel,
          accessibility: accessibilityPayload,
        });

        const saved = await saveRoute(generated.id).catch(() => null);
        const savedRoute = {
          ...generated,
          title: overrides?.title ?? generated.title,
          status: saved?.status ?? ('saved' as const),
        };
        setActiveRoute(savedRoute);
        addRouteToHistory(savedRoute);
        await queryClient.invalidateQueries({ queryKey: ['routes', 'history'] });
        navigation.navigate('ActiveRoute');
      } catch (err) {
        try {
          fallbackLocal(
            overrides ?? {},
            `Маршрут собран локально, потому что серверный подбор сейчас недоступен: ${extractApiError(err)}`,
          );
        } catch (fallbackError) {
          setError(
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Не удалось собрать маршрут',
          );
        }
      } finally {
        setIsBuilding(false);
      }
    },
    [
      token,
      interests,
      tempo,
      accessibility,
      budgetMax,
      durationMinHours,
      durationMaxHours,
      currentLocation,
      generateRoute,
      setActiveRoute,
      addRouteToHistory,
      queryClient,
      navigation,
      fallbackLocal,
    ],
  );

  return {
    build,
    isBuilding: isBuilding || generateRoute.isPending,
    error,
    notice,
    clearMessages: useCallback(() => {
      setError(null);
      setNotice(null);
    }, []),
    currentLocation,
  };
}

export type { BuildOverrides };
