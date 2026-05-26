import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePoes } from '../../entities/poe/hooks';
import { poeToPlace } from '../../entities/poe/mappers';
import { EKATERINBURG_CENTER } from '../../entities/place/places';
import type { Place } from '../../entities/place/types';
import { useActiveRouteStore } from '../../entities/route/activeRouteStore';
import { getLocalRoutePlaces } from '../../entities/route/localRouteGenerator';
import {
  useFinishRoute,
  useSaveRoute,
  useStartRoute,
  useUpdateRouteProgress,
} from '../../entities/route/hooks';
import { useRouteHistoryStore } from '../../entities/route/routeHistoryStore';
import type {
  RouteGeneratedPublic,
  RoutePointPublic,
  RouteStatus,
} from '../../entities/route/types';
import { YandexMap } from '../../features/map/YandexMap';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';

function isServerRoute(route: RouteGeneratedPublic) {
  return !route.id.startsWith('local-route-') && !route.id.startsWith('scenario-route-');
}

function paceLabel(pace: string): string {
  const map: Record<string, string> = {
    slow: 'спокойно',
    medium: 'средний темп',
    fast: 'быстро',
  };
  return map[pace] ?? pace;
}

function formatHours(durationMinutes: number): string {
  if (durationMinutes < 60) return `${durationMinutes} мин`;
  const hours = durationMinutes / 60;
  const rounded = Math.round(hours);
  const mod10 = rounded % 10;
  const mod100 = rounded % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? 'час'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? 'часа'
        : 'часов';
  return `${rounded} ${noun}`;
}

function formatKm(distanceMeters: number): string {
  const km = distanceMeters / 1000;
  return km % 1 === 0 ? `${km} км` : `${km.toFixed(1)} км`;
}

type AccessibilityFlags = {
  hasRamp: boolean;
  wideAccess: boolean;
  noStairs: boolean;
};

function aggregateAccessibility(places: Place[]): AccessibilityFlags {
  if (!places.length) {
    return { hasRamp: false, wideAccess: false, noStairs: false };
  }
  const hasRamp = places.every((place) => place.accessibility.includes('ramps'));
  const wideAccess = places.every((place) => place.accessibility.includes('wheelchair'));
  const noStairs = places.every((place) => place.accessibility.includes('avoid_stairs'));
  return { hasRamp, wideAccess, noStairs };
}

export function ActiveRouteScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const route = useActiveRouteStore((s) => s.route);
  const setRoute = useActiveRouteStore((s) => s.setRoute);
  const updateRoute = useRouteHistoryStore((s) => s.updateRoute);
  const startRoute = useStartRoute();
  const saveRoute = useSaveRoute();
  const progressRoute = useUpdateRouteProgress();
  const finishRoute = useFinishRoute();
  const [actionError, setActionError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number }>(
    EKATERINBURG_CENTER,
  );
  const [travelledPath, setTravelledPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [hasRealLocation, setHasRealLocation] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const poes = usePoes({ city_id: 'ekb', page: 1, limit: 100 });

  const updateLocalRouteStatus = (status: RouteStatus, progressOrder?: number) => {
    if (!route) return null;
    const updatedRoute = { ...route, status };
    updateRoute(updatedRoute);
    setRoute(updatedRoute);
    void progressOrder; // зарезервировано для подсветки текущей точки в будущем
    return updatedRoute;
  };

  const syncRouteQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['routes', 'history'] });
  };

  const handleToggleNavigation = async () => {
    if (!route) return;
    setActionError(null);
    const nextStatus = route.status === 'in_progress' ? 'saved' : 'in_progress';

    if (!isServerRoute(route)) {
      updateLocalRouteStatus(nextStatus);
      // Намеренно НЕ инициализируем travelledPath из currentLocation:
      // на этом этапе currentLocation чаще всего ещё равен дефолту
      // (EKATERINBURG_CENTER), а реальная координата придёт чуть позже из
      // watchPosition. Если префиксить трек центром города, потом первая
      // настоящая координата соединяется с ним прямой линией — пользователь
      // видит «фантомный» оранжевый отрезок через всю карту, хотя по факту
      // никуда не ходил.
      return;
    }

    try {
      if (nextStatus === 'in_progress') {
        const journey = await startRoute.mutateAsync(route.id);
        updateLocalRouteStatus(journey.status, journey.progress_order);
      } else {
        const saved = await saveRoute.mutateAsync(route.id);
        updateLocalRouteStatus(saved.status);
      }
      await syncRouteQueries();
    } catch (error) {
      setActionError(extractApiError(error));
    }
  };

  const handleFinish = async () => {
    if (!route) return;
    setActionError(null);

    if (!isServerRoute(route)) {
      updateRoute({ ...route, status: 'completed' });
      setRoute(null);
      navigation.navigate('Tabs');
      return;
    }

    try {
      if (route.status !== 'in_progress') {
        await startRoute.mutateAsync(route.id);
      }
      const journey = await finishRoute.mutateAsync(route.id);
      updateLocalRouteStatus(journey.status, journey.progress_order);
      setRoute(null);
      await syncRouteQueries();
      navigation.navigate('Tabs');
    } catch (error) {
      setActionError(extractApiError(error));
    }
  };

  const handlePointPress = (point: RoutePointPublic) => {
    if (route && isServerRoute(route) && route.status === 'in_progress') {
      progressRoute.mutate({ routeId: route.id, order: point.order });
    }
    navigation.navigate('PoeDetail', { poeId: point.poe_id });
  };

  const handleRemovePoint = (point: RoutePointPublic) => {
    if (!route) return;
    const filtered = route.points.filter((p) => p.poe_id !== point.poe_id);
    const renumbered: RoutePointPublic[] = filtered.map((p, idx) => ({
      ...p,
      order: idx + 1,
    }));
    const updated = { ...route, points: renumbered };
    setRoute(updated);
    if (!isServerRoute(updated)) {
      updateRoute(updated);
    }
  };

  // Замена точки — пока без UI выбора. В будущем тут будет открываться
  // экран выбора альтернативы. Сейчас просто открываем карту: пользователь
  // сможет добавить новую точку в draft, а затем перегенерировать маршрут.
  const handleReplacePoint = (_point: RoutePointPublic) => {
    navigation.navigate('Tabs');
  };

  useEffect(() => {
    if (route?.status !== 'in_progress') {
      if (watchIdRef.current != null) {
        globalThis.navigator?.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // Стираем «пройденный путь» как только пользователь приостанавливает
      // или завершает маршрут — иначе линия остаётся висеть на карте даже
      // в обычном статусе saved/completed.
      setTravelledPath((current) => (current.length ? [] : current));
      // Также сбрасываем флаг «есть реальная позиция» — заглушку
      // (EKATERINBURG_CENTER) нельзя выдавать за местоположение пользователя.
      setHasRealLocation(false);
      return;
    }

    const geolocation = globalThis.navigator?.geolocation;
    if (!geolocation || watchIdRef.current != null) return;

    watchIdRef.current = geolocation.watchPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const looksLikeEkaterinburg =
          point.lat > 56.4 && point.lat < 57.2 && point.lng > 59.8 && point.lng < 61.0;
        if (!looksLikeEkaterinburg) return;

        setCurrentLocation(point);
        setHasRealLocation(true);
        setTravelledPath((current) => {
          const last = current[current.length - 1];
          if (last) {
            const moved =
              Math.abs(last.lat - point.lat) > 0.00004 ||
              Math.abs(last.lng - point.lng) > 0.00004;
            if (!moved) return current;
            return [...current, point].slice(-500);
          }
          // Первая реальная координата: добавляем её в трек как начальную.
          // Дальнейшие точки будут пристыковываться к ней — никакой «прямой
          // через всю карту» из центра города больше не появится.
          return [point];
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );

    return () => {
      if (watchIdRef.current != null) {
        geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [route?.status]);

  const routePlaces = useMemo(() => {
    const backendPlaces = (poes.data?.data ?? []).map(poeToPlace);
    return getLocalRoutePlaces(backendPlaces);
  }, [poes.data?.data]);

  const poeById = useMemo(() => {
    const map = new Map<string, (typeof routePlaces)[number]>();
    routePlaces.forEach((item) => map.set(item.id, item));
    return map;
  }, [routePlaces]);

  const routeMapPlaces = useMemo(() => {
    return (route?.points ?? [])
      .map((point) => poeById.get(point.poe_id))
      .filter((place): place is (typeof routePlaces)[number] => Boolean(place));
  }, [poeById, route?.points]);

  // routePath начинается от currentLocation только в режиме навигации:
  // в обычном предпросмотре стартовая позиция почти всегда равна центру
  // города (fallback), и линия «из центра в первую точку» вводит в
  // заблуждение. Когда маршрут просто открыт — рисуем чистый путь по
  // точкам POI.
  const isInProgress = route?.status === 'in_progress';
  const routePath = useMemo(() => {
    if (!routeMapPlaces.length) return undefined;
    const placeCoords = routeMapPlaces.map((place) => ({ lat: place.lat, lng: place.lng }));
    return isInProgress ? [currentLocation, ...placeCoords] : placeCoords;
  }, [currentLocation, routeMapPlaces, isInProgress]);

  const accessibility = useMemo(
    () => aggregateAccessibility(routeMapPlaces),
    [routeMapPlaces],
  );

  if (!route) {
    return (
      <View style={styles.root}>
        <ScreenHeader />
        <View style={styles.content}>
          <Text style={styles.emptyTitle}>Маршрут не выбран</Text>
          <Text style={styles.emptyBody}>
            Сначала сгенерируйте маршрут на вкладке «Маршруты».
          </Text>
        </View>
      </View>
    );
  }

  const startButtonLabel = startRoute.isPending
    ? 'Запускаем…'
    : saveRoute.isPending
      ? 'Сохраняем…'
      : isInProgress
        ? 'Приостановить'
        : 'Начать';

  return (
    <View style={styles.root}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{route.title}</Text>

        <View style={styles.metaList}>
          <MetaRow icon="clock" label={formatHours(route.duration_minutes)} />
          <MetaRow icon="map" label={formatKm(route.distance_meters)} />
          <MetaRow icon="activity" label={paceLabel(route.pace)} />
          {route.pace === 'slow' ? (
            <MetaRow icon="cloud" label="подходит для текущей погоды" />
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Посетим:</Text>
        {route.points.length ? (
          route.points.map((point) => {
            const place = poeById.get(point.poe_id);
            const title = place?.name ?? point.title ?? point.poe_id;
            const address = place?.address;
            return (
              <View key={`${point.poe_id}-${point.order}`} style={styles.pointRow}>
                <Pressable
                  style={styles.pointBody}
                  onPress={() => handlePointPress(point)}
                  accessibilityRole="button"
                >
                  <Text style={styles.pointTitle}>{title}</Text>
                  {address ? (
                    <Text style={styles.pointAddress} numberOfLines={1}>
                      {address}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={styles.pointActions}>
                  <Pressable
                    accessibilityLabel="Заменить точку"
                    hitSlop={8}
                    style={styles.pointActionBtn}
                    onPress={() => handleReplacePoint(point)}
                  >
                    <Feather name="refresh-cw" size={18} color={colors.textPrimary} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Удалить точку"
                    hitSlop={8}
                    style={styles.pointActionBtn}
                    onPress={() => handleRemovePoint(point)}
                  >
                    <Feather name="trash-2" size={18} color={colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyBody}>В маршруте пока нет точек.</Text>
        )}

        {routeMapPlaces.length ? (
          <View style={styles.mapPreview}>
            <YandexMap
              places={routeMapPlaces}
              routePath={routePath}
              travelledPath={isInProgress ? travelledPath : undefined}
              currentLocation={
                isInProgress && hasRealLocation ? currentLocation : undefined
              }
              center={
                isInProgress && hasRealLocation ? currentLocation : undefined
              }
              zoom={13}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Открыть карту на весь экран"
              hitSlop={8}
              style={styles.fullscreenToggle}
              onPress={() => setFullscreenOpen(true)}
            >
              <Feather name="maximize-2" size={16} color={colors.textPrimary} />
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Доступность:</Text>
        <AccessibilityLine ok={accessibility.hasRamp} label="пандус" />
        <AccessibilityLine ok={accessibility.wideAccess} label="широкие проходы" />
        <AccessibilityLine ok={accessibility.noStairs} label="без ступеней" />

        {isInProgress ? (
          <Text style={styles.trackingText}>
            Навигация активна. Карта обновляет ваше положение и рисует пройденный путь.
          </Text>
        ) : null}
        {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

        <Pressable
          style={[
            styles.primaryButton,
            (startRoute.isPending || saveRoute.isPending || finishRoute.isPending) &&
              styles.buttonDisabled,
          ]}
          onPress={handleToggleNavigation}
          disabled={startRoute.isPending || saveRoute.isPending || finishRoute.isPending}
          accessibilityRole="button"
        >
          {startRoute.isPending || saveRoute.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{startButtonLabel}</Text>
          )}
        </Pressable>
        {isInProgress ? (
          <Pressable
            style={[
              styles.primaryButton,
              styles.secondaryButton,
              finishRoute.isPending && styles.buttonDisabled,
            ]}
            onPress={handleFinish}
            disabled={finishRoute.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {finishRoute.isPending ? 'Завершаем…' : 'Завершить'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={fullscreenOpen}
        animationType="slide"
        onRequestClose={() => setFullscreenOpen(false)}
      >
        <View style={styles.fullscreenRoot}>
          <YandexMap
            places={routeMapPlaces}
            routePath={routePath}
            travelledPath={isInProgress ? travelledPath : undefined}
            currentLocation={
              isInProgress && hasRealLocation ? currentLocation : undefined
            }
            center={
              isInProgress && hasRealLocation && followUser
                ? currentLocation
                : undefined
            }
            zoom={isInProgress ? 16 : 14}
            followUser={isInProgress && hasRealLocation && followUser}
          />
          <View style={styles.fullscreenTopBar} pointerEvents="box-none">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Закрыть карту"
              hitSlop={10}
              style={styles.fullscreenIconBtn}
              onPress={() => setFullscreenOpen(false)}
            >
              <Feather name="chevron-left" size={22} color={colors.textPrimary} />
            </Pressable>
            <View style={styles.fullscreenTitleWrap}>
              <Text style={styles.fullscreenTitle} numberOfLines={1}>
                {route.title}
              </Text>
              <Text style={styles.fullscreenSubtitle}>
                {isInProgress ? 'Навигация активна' : 'Превью маршрута'}
              </Text>
            </View>
            {isInProgress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={followUser ? 'Отключить follow' : 'Следовать за мной'}
                hitSlop={10}
                style={[
                  styles.fullscreenIconBtn,
                  followUser && styles.fullscreenIconBtnActive,
                ]}
                onPress={() => setFollowUser((v) => !v)}
              >
                <Feather
                  name="navigation"
                  size={20}
                  color={followUser ? colors.white : colors.textPrimary}
                />
              </Pressable>
            ) : (
              <View style={styles.fullscreenIconBtnPlaceholder} />
            )}
          </View>
          {isInProgress ? (
            <View style={styles.fullscreenLegend} pointerEvents="none">
              <LegendDot color={colors.textPrimary} label="маршрут" />
              <LegendDot color="#E58838" label="пройдено" />
              <LegendDot color="#D71920" label="вы здесь" />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function MetaRow({
  icon,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={16} color={colors.textPrimary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

function AccessibilityLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <View style={styles.accessRow}>
      <Feather
        name={ok ? 'check' : 'x'}
        size={16}
        color={ok ? colors.successText : colors.errorText}
      />
      <Text style={styles.accessLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  metaList: {
    gap: 8,
    marginBottom: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  sectionTitle: {
    marginTop: 6,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  pointBody: {
    flex: 1,
    minWidth: 0,
  },
  pointTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pointAddress: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  pointActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  pointActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  mapPreview: {
    marginTop: 18,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    position: 'relative',
  },
  fullscreenToggle: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fullscreenRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fullscreenIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fullscreenIconBtnActive: {
    backgroundColor: colors.textPrimary,
  },
  fullscreenIconBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  fullscreenTitleWrap: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fullscreenTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  fullscreenSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  fullscreenLegend: {
    position: 'absolute',
    left: 12,
    bottom: 24,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  accessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  accessLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  trackingText: {
    marginTop: 14,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  errorText: {
    marginTop: 10,
    color: colors.errorText,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: 20,
    alignSelf: 'center',
    backgroundColor: colors.accentButton,
    borderRadius: 10,
    paddingHorizontal: 36,
    paddingVertical: 12,
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: colors.textPrimary,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 20,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },
});
