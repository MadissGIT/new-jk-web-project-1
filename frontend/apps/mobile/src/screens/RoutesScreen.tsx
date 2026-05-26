import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '../entities/auth/authStore';
import {
  usePreferencesStore,
  type InterestId,
} from '../entities/preferences/preferencesStore';
import { usePoeFiltersStore } from '../entities/poe/poeUiStore';
import { useActiveRouteStore } from '../entities/route/activeRouteStore';
import { useRouteHistoryStore } from '../entities/route/routeHistoryStore';
import { fetchRoute } from '../entities/route/api';
import { useRouteHistory } from '../entities/route/hooks';
import {
  scenarioToOverrides,
  useRouteBuilder,
} from '../entities/route/useRouteBuilder';
import {
  useRouteScenarios,
  type RouteScenarioPublic,
} from '../entities/route/scenariosApi';
import type { MainStackParamList } from '../navigation/MainNavigator';
import { extractApiError } from '../shared/api/http';
import { colors } from '../shared/theme/colors';

const INTEREST_LABELS: Record<InterestId, string> = {
  art: 'искусство',
  coffee: 'кофе',
  history: 'история',
  nature: 'природа',
  music: 'музыка',
  relax: 'отдых',
};

// Маркеры быстрых сценариев: иконка Feather + slug в локальном генераторе.
// «more» — это кнопка «Ещё →», она запускает подбор по предпочтениям.
type QuickScenario = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  isMore?: boolean;
};

const MORE_SCENARIO: QuickScenario = {
  key: 'more',
  label: 'Ещё',
  icon: 'arrow-right',
  isMore: true,
};

function pickIcon(name: string, fallback: keyof typeof Feather.glyphMap) {
  return name in Feather.glyphMap ? (name as keyof typeof Feather.glyphMap) : fallback;
}

function formatHoursLabel(hours: number | null): string {
  if (!hours) return 'любое время';
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

function formatDistanceLabel(radiusMeters: number | null): string {
  if (!radiusMeters) return 'везде';
  if (radiusMeters >= 1000) {
    const km = radiusMeters / 1000;
    return km % 1 === 0 ? `${km} км` : `до ${km.toFixed(1)} км`;
  }
  return `${radiusMeters} м`;
}

function pickPrimaryInterest(interests: InterestId[]): string {
  if (!interests.length) return 'любое';
  return INTEREST_LABELS[interests[0]] ?? interests[0];
}

function routeStatusLabel(status: string) {
  const map: Record<string, string> = {
    draft: 'черновик',
    saved: 'сохранён',
    in_progress: 'в пути',
    completed: 'завершён',
    archived: 'архив',
  };
  return map[status] ?? status;
}

export function RoutesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const interests = usePreferencesStore((s) => s.interests);
  const durationMinHours = usePreferencesStore((s) => s.durationMinHours);
  const durationMaxHours = usePreferencesStore((s) => s.durationMaxHours);
  const radiusMeters = usePoeFiltersStore((s) => s.radiusMeters);

  const setActiveRoute = useActiveRouteStore((s) => s.setRoute);
  const activeRoute = useActiveRouteStore((s) => s.route);
  const routeHistory = useRouteHistoryStore((s) => s.routes);
  const removeLocalHistoryRoutes = useRouteHistoryStore((s) => s.removeRoutes);
  const routeHistoryQuery = useRouteHistory(Boolean(token));
  const routeScenarios = useRouteScenarios();
  const builder = useRouteBuilder();

  const [openingRouteId, setOpeningRouteId] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [hiddenHistoryIds, setHiddenHistoryIds] = useState<string[]>([]);

  const generateFromPrefs = () => {
    setGenerationError(null);
    builder.clearMessages();
    void builder.build();
  };

  const startQuickScenario = (scenario: RouteScenarioPublic | QuickScenario) => {
    setGenerationError(null);
    builder.clearMessages();
    if ('slug' in scenario) {
      void builder.build(scenarioToOverrides(scenario));
    } else {
      void builder.build();
    }
  };

  const openServerRoute = async (routeId: string) => {
    setGenerationError(null);
    setOpeningRouteId(routeId);
    try {
      const route = await queryClient.fetchQuery({
        queryKey: ['routes', 'detail', routeId],
        queryFn: () => fetchRoute(routeId),
        staleTime: 30_000,
      });
      setActiveRoute(route);
      navigation.navigate('ActiveRoute');
    } catch (error) {
      setGenerationError(extractApiError(error));
    } finally {
      setOpeningRouteId(null);
    }
  };

  const serverRoutes = routeHistoryQuery.data?.data ?? [];
  const localHistory = routeHistory;
  const visibleServerRoutes = useMemo(
    () => serverRoutes.filter((item) => !hiddenHistoryIds.includes(item.id)),
    [serverRoutes, hiddenHistoryIds],
  );
  const visibleLocalHistory = useMemo(
    () => localHistory.filter((item) => !hiddenHistoryIds.includes(item.id)),
    [localHistory, hiddenHistoryIds],
  );
  const hasServerHistory = visibleServerRoutes.length > 0;

  // Делим истории на две части: «Для вас» — самые свежие (3 верхних), всё остальное идёт в свёрнутую «История».
  const featuredItems = useMemo(() => {
    const activeRouteId = activeRoute?.id;
    if (hasServerHistory) {
      return visibleServerRoutes
        .filter((item) => item.id !== activeRouteId)
        .slice(0, 3)
        .map((item) => ({
        kind: 'server' as const,
        id: item.id,
        title: item.title,
        status: item.status,
        distanceMeters: item.distance_meters,
        durationMinutes: item.duration_minutes,
        moodLabel: undefined as string | undefined,
      }));
    }
    return visibleLocalHistory
      .filter((item) => item.id !== activeRouteId)
      .slice(0, 3)
      .map((item) => ({
      kind: 'local' as const,
      id: item.id,
      title: item.title,
      status: item.status,
      distanceMeters: item.distance_meters,
      durationMinutes: item.duration_minutes,
      moodLabel: item.description,
    }));
  }, [activeRoute?.id, hasServerHistory, visibleServerRoutes, visibleLocalHistory]);

  const olderItems = useMemo(() => {
    if (hasServerHistory) {
      return visibleServerRoutes.slice(3).map((item) => ({
        kind: 'server' as const,
        id: item.id,
        title: item.title,
        status: item.status,
        distanceMeters: item.distance_meters,
        durationMinutes: item.duration_minutes,
      }));
    }
    return visibleLocalHistory.slice(3).map((item) => ({
      kind: 'local' as const,
      id: item.id,
      title: item.title,
      status: item.status,
      distanceMeters: item.distance_meters,
      durationMinutes: item.duration_minutes,
    }));
  }, [hasServerHistory, visibleServerRoutes, visibleLocalHistory]);

  const hasActive = Boolean(activeRoute);
  const clearableHistoryIds = olderItems.map((item) => item.id);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Маршруты</Text>
      <Text style={styles.subheading}>Куда отправимся сегодня?</Text>

      <View style={styles.filtersRow}>
        <FilterChip
          icon="clock"
          label={formatHoursLabel(durationMaxHours ?? durationMinHours)}
          onPress={() => navigation.navigate('ProfileInterests')}
        />
        <FilterChip
          icon="tag"
          label={pickPrimaryInterest(interests)}
          onPress={() => navigation.navigate('ProfileInterests')}
        />
        <Pressable
          style={styles.filterIconBtn}
          accessibilityLabel="Открыть фильтры карты"
          onPress={() => navigation.navigate('MapFilters')}
        >
          <Feather name="box" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.filtersRow}>
        <FilterChip
          icon="map-pin"
          label={formatDistanceLabel(radiusMeters)}
          onPress={() => navigation.navigate('MapFilters')}
        />
      </View>

      <Pressable
        style={[styles.generateBtn, builder.isBuilding && styles.generateBtnDisabled]}
        onPress={generateFromPrefs}
        disabled={builder.isBuilding}
        accessibilityRole="button"
      >
        {builder.isBuilding ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.generateBtnText}>Сгенерировать маршрут</Text>
        )}
      </Pressable>

      {builder.notice ? <Text style={styles.noticeText}>{builder.notice}</Text> : null}
      {builder.error ? <Text style={styles.errorText}>{builder.error}</Text> : null}
      {generationError ? <Text style={styles.errorText}>{generationError}</Text> : null}

      <Text style={styles.sectionTitle}>Быстрые сценарии</Text>
      <View style={styles.scenarioGrid}>
        {routeScenarios.isLoading ? (
          <Text style={styles.noticeText}>Загружаем сценарии...</Text>
        ) : null}
        {(routeScenarios.data ?? []).map((scenario) => (
          <Pressable
            key={scenario.id}
            style={[styles.scenarioCard, builder.isBuilding && styles.scenarioCardDisabled]}
            onPress={() => startQuickScenario(scenario)}
            disabled={builder.isBuilding}
            accessibilityRole="button"
          >
            <Feather
              name={pickIcon(scenario.icon, 'map')}
              size={18}
              color={colors.textPrimary}
            />
            <Text style={styles.scenarioLabel} numberOfLines={2}>
              {scenario.title}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.scenarioCard, builder.isBuilding && styles.scenarioCardDisabled]}
          onPress={() => startQuickScenario(MORE_SCENARIO)}
          disabled={builder.isBuilding}
          accessibilityRole="button"
        >
          <Feather name={MORE_SCENARIO.icon} size={18} color={colors.textPrimary} />
          <Text style={styles.scenarioLabel}>{MORE_SCENARIO.label}</Text>
        </Pressable>
        {!routeScenarios.isLoading && !routeScenarios.data?.length ? (
          <Text style={styles.noticeText}>Сценарии пока не настроены.</Text>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Для вас</Text>
      {hasActive && activeRoute ? (
        <RouteFeaturedCard
          status="active"
          title={activeRoute.title}
          distanceMeters={activeRoute.distance_meters}
          durationMinutes={activeRoute.duration_minutes}
          moodLabel={undefined}
          actionLabel="Продолжить"
          onPress={() => navigation.navigate('ActiveRoute')}
          loading={false}
        />
      ) : null}
      {featuredItems.length === 0 && !hasActive ? (
        <Text style={styles.emptyText}>
          Нажмите «Сгенерировать маршрут» или выберите сценарий — он появится здесь.
        </Text>
      ) : null}
      {featuredItems.map((item) => (
        <RouteFeaturedCard
          key={item.id}
          status={item.status === 'in_progress' ? 'active' : 'planned'}
          title={item.title}
          distanceMeters={item.distanceMeters}
          durationMinutes={item.durationMinutes}
          moodLabel={'moodLabel' in item ? item.moodLabel : undefined}
          actionLabel={item.status === 'in_progress' ? 'Продолжить' : 'Начать'}
          onPress={() => {
            if (item.kind === 'server') {
              openServerRoute(item.id);
            } else {
              const local = visibleLocalHistory.find((r) => r.id === item.id);
              if (local) setActiveRoute(local);
              navigation.navigate('ActiveRoute');
            }
          }}
          loading={openingRouteId === item.id}
        />
      ))}

      <View style={styles.historyHeader}>
        <Pressable
          style={styles.historyHeaderLeft}
          onPress={() => setHistoryExpanded((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={[styles.sectionTitle, styles.historyTitleCompact]}>История</Text>
          <Feather
            name={historyExpanded ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={colors.textPrimary}
          />
        </Pressable>
        {clearableHistoryIds.length > 0 ? (
          <Pressable
            style={styles.historyClearBtn}
            onPress={() => {
              setHiddenHistoryIds((current) =>
                Array.from(new Set([...current, ...clearableHistoryIds])),
              );
              removeLocalHistoryRoutes(clearableHistoryIds);
              setHistoryExpanded(false);
            }}
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={16} color={colors.textPrimary} />
            <Text style={styles.historyClearText}>Очистить</Text>
          </Pressable>
        ) : null}
      </View>
      {historyExpanded ? (
        olderItems.length ? (
          olderItems.map((item) => (
            <Pressable
              key={item.id}
              style={styles.historyCard}
              onPress={() => {
                if (item.kind === 'server') {
                  openServerRoute(item.id);
                } else {
                  const local = visibleLocalHistory.find((r) => r.id === item.id);
                  if (local) setActiveRoute(local);
                  navigation.navigate('ActiveRoute');
                }
              }}
            >
              <Text style={styles.historyTitle}>{item.title}</Text>
              <Text style={styles.historyMeta}>
                {(item.distanceMeters / 1000).toFixed(1)} км ·{' '}
                {Math.round(item.durationMinutes / 60)} ч ·{' '}
                {routeStatusLabel(item.status)}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={styles.emptyText}>Других маршрутов пока нет.</Text>
        )
      ) : null}

      {routeHistoryQuery.isError ? (
        <Text style={styles.noticeText}>
          История с сервера недоступна: {extractApiError(routeHistoryQuery.error)}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function FilterChip({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.filterChip} onPress={onPress} accessibilityRole="button">
      <Feather name={icon} size={14} color={colors.textPrimary} />
      <Text style={styles.filterChipText}>{label}</Text>
      <Feather name="chevron-down" size={14} color={colors.textPrimary} />
    </Pressable>
  );
}

function RouteFeaturedCard({
  status,
  title,
  distanceMeters,
  durationMinutes,
  moodLabel,
  actionLabel,
  onPress,
  loading,
}: {
  status: 'active' | 'planned';
  title: string;
  distanceMeters: number;
  durationMinutes: number;
  moodLabel?: string;
  actionLabel: string;
  onPress: () => void;
  loading: boolean;
}) {
  const isActive = status === 'active';
  return (
    <View style={styles.featuredCard}>
      <View style={styles.featuredStatusRow}>
        <View
          style={[
            styles.featuredStatusDot,
            isActive ? styles.featuredStatusDotActive : styles.featuredStatusDotPlanned,
          ]}
        />
        <Text style={styles.featuredStatusText}>
          {isActive ? 'Сейчас активен' : 'В планах'}
        </Text>
      </View>
      <Text style={styles.featuredTitle}>{title}</Text>
      <Text style={styles.featuredMeta}>
        {(distanceMeters / 1000).toFixed(1)} км · {Math.round(durationMinutes / 60)} ч
        {moodLabel ? ` · ${moodLabel}` : ''}
      </Text>
      <Pressable
        style={styles.featuredAction}
        onPress={onPress}
        disabled={loading}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator color={colors.textPrimary} size="small" />
        ) : (
          <Text style={styles.featuredActionText}>{actionLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 32 },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subheading: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filtersRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterChipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  generateBtn: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: colors.accentButton,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnDisabled: { opacity: 0.7 },
  generateBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 17,
  },
  noticeText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    color: colors.errorText,
  },
  draftMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  scenarioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  scenarioCard: {
    width: '48%',
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  scenarioCardDisabled: {
    opacity: 0.65,
  },
  scenarioLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  featuredCard: {
    marginBottom: 18,
  },
  featuredStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  featuredStatusDotActive: {
    backgroundColor: colors.statusActive,
  },
  featuredStatusDotPlanned: {
    backgroundColor: colors.statusPlanned,
  },
  featuredStatusText: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  featuredTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  featuredMeta: {
    marginTop: 2,
    fontSize: 14,
    color: colors.textSubtle,
  },
  featuredAction: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  featuredActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  historyHeader: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyTitleCompact: {
    marginTop: 0,
    marginBottom: 0,
  },
  historyClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyClearText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyCard: {
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
});
