import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '../entities/auth/authStore';
import { usePreferencesStore } from '../entities/preferences/preferencesStore';
import { useActiveRouteStore } from '../entities/route/activeRouteStore';
import { useRouteHistoryStore } from '../entities/route/routeHistoryStore';
import {
  scenarioToOverrides,
  useRouteBuilder,
} from '../entities/route/useRouteBuilder';
import {
  useRouteScenarios,
  type RouteScenarioPublic,
} from '../entities/route/scenariosApi';
import { CURRENT_LOCATION_FALLBACK } from '../entities/route/readyRoutes';
import { useNearbyTours, type NearbyTourItem } from '../entities/tour/useNearbyTours';
import { useExtrasForCurrentUser } from '../shared/profile/useExtrasForCurrentUser';
import type { MainStackParamList } from '../navigation/MainNavigator';
import { colors } from '../shared/theme/colors';

type FeatherIconName = keyof typeof Feather.glyphMap;

const INTEREST_LABELS: Record<string, string> = {
  art: 'искусство',
  coffee: 'кофе',
  history: 'история',
  nature: 'природа',
  music: 'музыка',
  relax: 'спокойно',
};

function getGreetingName(fullName: string | undefined, fallback: string) {
  if (!fullName) return fallback;
  const [, name] = fullName.split(/\s+/);
  return name?.trim() || fullName.trim() || fallback;
}

function formatDurationLabel(hours: number | null | undefined) {
  if (!hours || hours < 1) return '2 часа';
  const rounded = Math.round(hours);
  if (rounded === 1) return '1 час';
  if (rounded >= 2 && rounded <= 4) return `${rounded} часа`;
  return `${rounded} часов`;
}

function pickIcon(name: string, fallback: FeatherIconName): FeatherIconName {
  return name in Feather.glyphMap ? (name as FeatherIconName) : fallback;
}

export function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const userId = useAuthStore((s) => s.user?.id);
  const extras = useExtrasForCurrentUser(userId);

  const preferenceInterests = usePreferencesStore((s) => s.interests);
  const durationMinHours = usePreferencesStore((s) => s.durationMinHours);
  const durationMaxHours = usePreferencesStore((s) => s.durationMaxHours);

  const activeRoute = useActiveRouteStore((s) => s.route);
  const routeHistory = useRouteHistoryStore((s) => s.routes);

  const scenarios = useRouteScenarios();
  const builder = useRouteBuilder();
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  }>(CURRENT_LOCATION_FALLBACK);
  const nearbyTours = useNearbyTours(currentLocation, 2);

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

  const serverFullName = user
    ? `${user.surname ?? ''} ${user.name ?? ''}`.trim()
    : '';
  const composedName = extras.fullName ?? serverFullName;
  const firstName = getGreetingName(composedName || undefined, 'гость');

  const primaryInterestLabel = preferenceInterests.length
    ? INTEREST_LABELS[preferenceInterests[0]] ?? preferenceInterests[0]
    : 'интересы';
  const averageDuration =
    durationMinHours && durationMaxHours
      ? (durationMinHours + durationMaxHours) / 2
      : durationMinHours ?? durationMaxHours ?? 2;
  const durationLabel = formatDurationLabel(averageDuration);

  const plannedRoutes = routeHistory
    .filter((route) => route.id !== activeRoute?.id && route.status !== 'completed')
    .slice(0, 3);

  const handleGeneratePrimary = () => {
    void builder.build();
  };

  const handleScenarioPress = (scenario: RouteScenarioPublic) => {
    void builder.build(scenarioToOverrides(scenario));
  };

  const openInterestPicker = () => navigation.navigate('ProfileInterests');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Добрый день,{'\n'}{firstName}!</Text>
        <Pressable
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('Tabs')}
        >
          <Feather name="map-pin" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Text style={styles.sectionLead}>Куда отправимся сегодня?</Text>

      <View style={styles.filtersRow}>
        <View style={styles.filtersLeft}>
          <View style={styles.filtersGroup}>
            <FilterChip label={durationLabel} onPress={openInterestPicker} />
            <FilterChip label={primaryInterestLabel} onPress={openInterestPicker} />
          </View>
          <View style={styles.filtersGroup}>
            <FilterChip label="рядом" onPress={openInterestPicker} />
          </View>
        </View>
        <Pressable style={styles.boxBtn} onPress={openInterestPicker}>
          <Feather name="box" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Pressable
        style={[styles.generateBtn, builder.isBuilding && styles.generateBtnDisabled]}
        disabled={builder.isBuilding}
        onPress={handleGeneratePrimary}
      >
        {builder.isBuilding ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.generateBtnText}>Сгенерировать маршрут</Text>
        )}
      </Pressable>

      {builder.notice ? <Text style={styles.noticeText}>{builder.notice}</Text> : null}
      {builder.error ? <Text style={styles.errorText}>{builder.error}</Text> : null}

      <Text style={styles.sectionTitle}>Быстрые сценарии</Text>
      <View style={styles.quickGrid}>
        {scenarios.isLoading ? (
          <Text style={styles.noticeText}>Загружаем сценарии...</Text>
        ) : scenarios.data?.length ? (
          scenarios.data.map((scenario) => (
            <QuickCard
              key={scenario.id}
              scenario={scenario}
              disabled={builder.isBuilding}
              onPress={() => handleScenarioPress(scenario)}
            />
          ))
        ) : (
          <Text style={styles.noticeText}>Сценарии пока не настроены.</Text>
        )}
      </View>

      <Text style={styles.sectionTitle}>Для вас</Text>
      {activeRoute ? (
        <RouteRow
          title={activeRoute.title}
          metaPrimary={`${(activeRoute.distance_meters / 1000).toFixed(1)} км  •  ${Math.round(activeRoute.duration_minutes / 60)} часа`}
          ctaLabel="Продолжить"
          statusLabel="Сейчас активен"
          statusColor={colors.statusActive}
          onPress={() => navigation.navigate('ActiveRoute')}
        />
      ) : null}
      {plannedRoutes.map((route) => (
        <RouteRow
          key={route.id}
          title={route.title}
          metaPrimary={`${(route.distance_meters / 1000).toFixed(1)} км  •  ${Math.round(route.duration_minutes / 60)} ч  •  ${route.pace}`}
          ctaLabel="Начать"
          statusLabel="В планах"
          statusColor={colors.statusPlanned}
          onPress={() => {
            useActiveRouteStore.getState().setRoute(route);
            navigation.navigate('ActiveRoute');
          }}
        />
      ))}
      {!activeRoute && plannedRoutes.length === 0 ? (
        <Text style={styles.noticeText}>
          Сгенерируйте маршрут — он появится здесь и в разделе «Маршруты».
        </Text>
      ) : null}

      <Text style={styles.sectionTitle}>Рядом сейчас</Text>
      {nearbyTours.isLoading ? (
        <ActivityIndicator color={colors.textPrimary} style={styles.nearbyLoader} />
      ) : nearbyTours.items.length ? (
        <View style={styles.nearbyRow}>
          {nearbyTours.items.map((item) => (
            <NearbyCard
              key={item.tour.id}
              item={item}
              onPress={() =>
                navigation.navigate('TourDetail', { tourId: item.tour.id })
              }
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noticeText}>
          Опубликованных туров рядом пока нет. Загляните в раздел «Туры».
        </Text>
      )}

      <View style={{ height: 16 }} />
    </ScrollView>
  );
}

function FilterChip({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
      <Feather name="chevron-down" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

function QuickCard({
  scenario,
  disabled,
  onPress,
}: {
  scenario: RouteScenarioPublic;
  disabled?: boolean;
  onPress: () => void;
}) {
  const iconName = pickIcon(scenario.icon, 'map');
  return (
    <Pressable
      style={[styles.quickCard, disabled && styles.quickCardDisabled]}
      disabled={disabled}
      onPress={onPress}
    >
      <Feather
        name={iconName}
        size={18}
        color={colors.textPrimary}
        style={styles.quickIcon}
      />
      <Text style={styles.quickText} numberOfLines={1}>
        {scenario.title}
      </Text>
    </Pressable>
  );
}

function RouteRow({
  title,
  metaPrimary,
  ctaLabel,
  statusLabel,
  statusColor,
  onPress,
}: {
  title: string;
  metaPrimary: string;
  ctaLabel: string;
  statusLabel: string;
  statusColor: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.routeRow}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>{statusLabel}</Text>
      </View>
      <Text style={styles.routeTitle}>{title}</Text>
      <Text style={styles.routeMeta}>{metaPrimary}</Text>
      <Pressable style={styles.pillBtn} onPress={onPress}>
        <Text style={styles.pillBtnText}>{ctaLabel}</Text>
      </Pressable>
    </View>
  );
}

function NearbyCard({
  item,
  onPress,
}: {
  item: NearbyTourItem;
  onPress: () => void;
}) {
  const { tour } = item;
  return (
    <View style={styles.nearbyCard}>
      <View style={styles.nearbyImage}>
        {tour.cover_image_url ? (
          <Image
            source={{ uri: tour.cover_image_url }}
            style={styles.nearbyImageFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.nearbyImageFill, styles.nearbyImagePlaceholder]}>
            <Feather name="image" size={28} color="rgba(255,255,255,0.5)" />
          </View>
        )}
        <View style={styles.ratingPill}>
          <Feather name="star" size={10} color={colors.white} />
          <Text style={styles.ratingText}>
            {tour.rating.toFixed(1).replace('.', ',')} ({tour.reviews_count})
          </Text>
        </View>
      </View>
      <Text style={styles.nearbyTitle} numberOfLines={2}>
        {tour.title}
      </Text>
      <Text style={styles.nearbyMeta}>{item.schedule}</Text>
      <Text style={styles.nearbyPrice}>
        {tour.price.amount.toLocaleString('ru-RU')} руб.
      </Text>
      <Pressable style={[styles.pillBtn, styles.pillBtnFull]} onPress={onPress}>
        <Text style={styles.pillBtnText}>Подробнее</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 32,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionLead: {
    marginTop: 20,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  filtersRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filtersLeft: {
    flex: 1,
    gap: 8,
  },
  filtersGroup: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  boxBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  generateBtn: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: colors.accentButton,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 260,
    alignItems: 'center',
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  noticeText: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  errorText: {
    marginTop: 10,
    color: colors.errorText,
    fontSize: 13,
    fontWeight: '700',
  },

  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  quickCardDisabled: {
    opacity: 0.6,
  },
  quickIcon: {
    opacity: 0.9,
  },
  quickText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    flexShrink: 1,
  },

  routeRow: {
    marginBottom: 14,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  routeTitle: {
    marginTop: 4,
    fontSize: 17,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  routeMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
  },
  pillBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  pillBtnFull: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  pillBtnText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  nearbyLoader: {
    marginVertical: 12,
  },
  nearbyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nearbyCard: {
    flex: 1,
  },
  nearbyImage: {
    height: 92,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 8,
    backgroundColor: colors.line,
  },
  nearbyImageFill: {
    ...StyleSheet.absoluteFillObject,
  },
  nearbyImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8A7D68',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  nearbyTitle: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  nearbyMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 12,
  },
  nearbyPrice: {
    marginTop: 4,
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
  },
});
