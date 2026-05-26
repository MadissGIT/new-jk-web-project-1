import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { InterestId } from '../entities/preferences/preferencesStore';
import { CURRENT_LOCATION_FALLBACK } from '../entities/route/readyRoutes';
import { useTourFiltersStore } from '../entities/tour/tourUiStore';
import {
  formatHoursRu,
  formatTourCardSchedule,
  getTourSlotState,
  pickUpcomingSlot,
} from '../entities/tour/formatSchedule';
import { useTourSlots, useTours } from '../entities/tour/hooks';
import type { TourPublic } from '../entities/tour/types';
import type { Place } from '../entities/place/types';
import { YandexMap } from '../features/map/YandexMap';
import type { MainStackParamList } from '../navigation/MainNavigator';
import { extractApiError } from '../shared/api/http';
import { colors } from '../shared/theme/colors';

const SEARCH_ALIASES: Record<string, string[]> = {
  гастро: ['coffee', 'food', 'restaurant', 'кафе', 'кофе'],
  еда: ['coffee', 'food', 'restaurant', 'гастро'],
  кофе: ['coffee', 'cafe', 'кафе', 'кофейня'],
  кофейня: ['coffee', 'cafe', 'кофе'],
  кафе: ['coffee', 'cafe', 'кофе'],
  арт: ['art', 'искусство', 'галерея', 'музей'],
  искусство: ['art', 'галерея', 'музей'],
  прогулка: ['walk', 'route', 'walking'],
  прогулки: ['walk', 'route', 'walking'],
  история: ['history', 'museum', 'исторический'],
  музей: ['history', 'museum', 'art'],
  природа: ['nature', 'park', 'сад'],
  парк: ['nature', 'park', 'сад'],
  музыка: ['music', 'concert', 'club'],
};

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const earthRadius = 6371000;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function normalizeSearchTerms(query: string) {
  const words = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const terms = new Set(words);
  for (const word of words) {
    for (const alias of SEARCH_ALIASES[word] ?? []) {
      terms.add(alias);
    }
  }
  return [...terms];
}

function inferTourCategories(tour: TourPublic): InterestId[] {
  const tags = tour.tags ?? [];
  const haystack = `${tour.title} ${tour.short_description} ${tags.join(' ')}`.toLowerCase();
  const categories = new Set<InterestId>();

  if (/\b(art|gallery|museum)\b|арт|искусств|галере|музе/.test(haystack)) {
    categories.add('art');
  }
  if (/\b(coffee|cafe|food|restaurant|gastro)\b|кофе|кафе|гастро|ресторан/.test(haystack)) {
    categories.add('coffee');
  }
  if (/\b(history|historic)\b|истори|стар/.test(haystack)) {
    categories.add('history');
  }
  if (/\b(nature|park)\b|природ|парк|сад/.test(haystack)) {
    categories.add('nature');
  }
  if (/\b(music|concert|club)\b|музык|концерт|клуб/.test(haystack)) {
    categories.add('music');
  }
  if (categories.size === 0) {
    categories.add('relax');
  }

  return [...categories];
}

function getTourMeetingPoint(tour: TourPublic) {
  const meetingPoint = (tour as TourPublic & { meeting_point?: TourPublic['meeting_point'] })
    .meeting_point;
  return {
    lat: meetingPoint?.lat ?? CURRENT_LOCATION_FALLBACK.lat,
    lng: meetingPoint?.lng ?? CURRENT_LOCATION_FALLBACK.lng,
    address: meetingPoint?.address ?? 'Место встречи уточняется',
  };
}

function tourToMapPlace(tour: TourPublic): Place {
  const meetingPoint = getTourMeetingPoint(tour);
  const categories = inferTourCategories(tour);
  const accessibility: Place['accessibility'] = [];
  if (tour.accessibility.wheelchair_accessible) {
    accessibility.push('wheelchair', 'ramps');
  }
  if (tour.accessibility.avoid_stairs_possible) {
    accessibility.push('avoid_stairs');
  }
  if (accessibility.length === 0) {
    accessibility.push('none');
  }

  return {
    id: tour.id,
    name: tour.title,
    description: tour.short_description,
    categories,
    priceMin: tour.price.amount,
    priceMax: tour.price.amount,
    durationHours: Math.max(1, Math.round(tour.duration_minutes / 60)),
    lat: meetingPoint.lat,
    lng: meetingPoint.lng,
    address: meetingPoint.address,
    accessibility,
  };
}

function matchesTourSearch(tour: TourPublic, query: string) {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) return true;
  const meetingPoint = getTourMeetingPoint(tour);
  const haystack = [
    tour.title,
    tour.short_description,
    tour.guide.name,
    meetingPoint.address,
    ...(tour.tags ?? []),
    ...inferTourCategories(tour),
  ]
    .join(' ')
    .toLowerCase();

  return terms.some((term) => haystack.includes(term));
}

function matchesInterestFilters(tour: TourPublic, filters: string[]) {
  if (filters.length === 0) return true;
  const haystack = [
    tour.title,
    tour.short_description,
    ...(tour.tags ?? []),
    ...inferTourCategories(tour),
  ]
    .join(' ')
    .toLowerCase();

  return filters.some((filter) => {
    if (filter === 'walk') {
      return /walk|route|walking|прогул/.test(haystack);
    }
    if (filter === 'coffee') {
      return /coffee|cafe|food|restaurant|gastro|кофе|кафе|гастро|ресторан/.test(
        haystack,
      );
    }
    return haystack.includes(filter);
  });
}

function matchesPriceFilter(
  tour: TourPublic,
  min: number | null,
  max: number | null,
) {
  const price = tour.price.amount;
  if (min != null && price < min) return false;
  if (max != null && price > max) return false;
  return true;
}

function matchesDurationFilter(
  tour: TourPublic,
  minHours: number | null,
  maxHours: number | null,
) {
  const hours = tour.duration_minutes / 60;
  if (minHours != null && hours < minHours) return false;
  if (maxHours != null && hours > maxHours) return false;
  return true;
}

function matchesAccessibilityFilters(tour: TourPublic, filters: string[]) {
  if (filters.length === 0 || filters.includes('none')) return true;
  if (
    filters.some((item) => item === 'wheelchair' || item === 'ramps') &&
    !tour.accessibility.wheelchair_accessible
  ) {
    return false;
  }
  if (filters.includes('avoid_stairs') && !tour.accessibility.avoid_stairs_possible) {
    return false;
  }
  if (filters.includes('hearing')) {
    const haystack = `${tour.title} ${tour.short_description} ${(tour.tags ?? []).join(' ')}`.toLowerCase();
    if (/club|music|concert|клуб|музык|концерт|ночн/.test(haystack)) {
      return false;
    }
  }
  return true;
}

export function ToursScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const priceMin = useTourFiltersStore((s) => s.priceMin);
  const priceMax = useTourFiltersStore((s) => s.priceMax);
  const durationMinHours = useTourFiltersStore((s) => s.durationMinHours);
  const durationMaxHours = useTourFiltersStore((s) => s.durationMaxHours);
  const interestFilters = useTourFiltersStore((s) => s.interests);
  const accessibilityFilters = useTourFiltersStore((s) => s.accessibility);
  const radiusMeters = useTourFiltersStore((s) => s.radiusMeters);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  }>(CURRENT_LOCATION_FALLBACK);

  const tourQuery = useMemo(
    () => ({
      city_id: 'ekb',
      page: 1,
      limit: 100,
    }),
    [],
  );
  const tours = useTours(tourQuery);

  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['tours', 'list'] });
    }, [queryClient]),
  );

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

  const filtered = useMemo(() => {
    const items = tours.data?.data ?? [];
    const q = submittedQuery.trim();
    return items
      .filter((item) => matchesTourSearch(item, q))
      .filter((item) => matchesPriceFilter(item, priceMin, priceMax))
      .filter((item) => matchesDurationFilter(item, durationMinHours, durationMaxHours))
      .filter((item) => matchesInterestFilters(item, interestFilters))
      .filter((item) => matchesAccessibilityFilters(item, accessibilityFilters))
      .filter((item) => {
        if (radiusMeters == null) return true;
        return distanceMeters(currentLocation, getTourMeetingPoint(item)) <= radiusMeters;
      })
      .sort(
        (a, b) =>
          distanceMeters(currentLocation, getTourMeetingPoint(a)) -
          distanceMeters(currentLocation, getTourMeetingPoint(b)),
      );
  }, [
    accessibilityFilters,
    currentLocation,
    durationMaxHours,
    durationMinHours,
    interestFilters,
    priceMax,
    priceMin,
    radiusMeters,
    submittedQuery,
    tours.data?.data,
  ]);

  const mapPlaces = useMemo(() => filtered.map(tourToMapPlace), [filtered]);
  const selectedTour = useMemo(
    () => filtered.find((item) => item.id === selectedId),
    [filtered, selectedId],
  );
  const selectedPlace = selectedTour ? tourToMapPlace(selectedTour) : undefined;
  const mapCenter = selectedPlace ?? currentLocation;

  useEffect(() => {
    if (selectedId && !filtered.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filtered, selectedId]);

  const applySearch = () => {
    setSubmittedQuery(query.trim());
    setSelectedId(null);
  };

  if (tours.isLoading && filtered.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (tours.isError && filtered.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Туры</Text>
        <Text style={styles.errorText}>{extractApiError(tours.error)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Туры</Text>
      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={applySearch}
            placeholder="Поиск"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.filterBtn}
          onPress={() => navigation.navigate('TourFilters')}
        >
          <Feather name="sliders" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, tab === 'list' && styles.segmentBtnActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.segmentText, tab === 'list' && styles.segmentTextActive]}>
            Список
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, tab === 'map' && styles.segmentBtnActive]}
          onPress={() => setTab('map')}
        >
          <Text style={[styles.segmentText, tab === 'map' && styles.segmentTextActive]}>
            Карта
          </Text>
        </Pressable>
      </View>

      {tab === 'map' ? (
        <View style={styles.mapMode}>
          <View style={styles.mapWrap}>
            {mapPlaces.length > 0 ? (
              <YandexMap
                places={mapPlaces}
                selectedId={selectedTour?.id ?? null}
                onSelect={setSelectedId}
                center={mapCenter}
                currentLocation={currentLocation}
                zoom={13}
              />
            ) : (
              <View style={styles.emptyMap}>
                <Text style={styles.emptyTitle}>Туры не найдены</Text>
                <Text style={styles.emptyText}>Попробуйте изменить фильтры или запрос.</Text>
              </View>
            )}
          </View>
          {selectedTour ? (
            <TourMapPreview
              tour={selectedTour}
              onClose={() => setSelectedId(null)}
              onDetails={() => navigation.navigate('TourDetail', { tourId: selectedTour.id })}
            />
          ) : null}
        </View>
      ) : (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyTitle}>Ничего не найдено</Text>
                <Text style={styles.emptyText}>Смягчите фильтры или попробуйте другой запрос.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <TourCard
                tour={item}
                onDetails={() => navigation.navigate('TourDetail', { tourId: item.id })}
                onMap={() => {
                  setSelectedId(item.id);
                  setTab('map');
                }}
              />
            )}
          />
          {tours.isError ? (
            <Text style={styles.errorText}>{extractApiError(tours.error)}</Text>
          ) : null}
        </>
      )}
    </View>
  );
}

function TourCardSchedule({
  tourId,
  durationMinutes,
}: {
  tourId: string;
  durationMinutes: number;
}) {
  const slots = useTourSlots(tourId);
  const state = getTourSlotState(slots.data, durationMinutes);
  const slot = state.active ?? pickUpcomingSlot(slots.data);
  const label = slot
    ? formatTourCardSchedule(slot.starts_at, durationMinutes, slot.ends_at)
    : state.ended
      ? 'Тур прошел'
      : `${formatHoursRu(Math.max(1, Math.round(durationMinutes / 60)))} · дата уточняется`;

  return <Text style={styles.meta}>{label}</Text>;
}

function TourCard({
  tour,
  onDetails,
  onMap,
}: {
  tour: TourPublic;
  onDetails: () => void;
  onMap: () => void;
}) {
  return (
    <View style={styles.card}>
      {tour.cover_image_url ? (
        <Image source={{ uri: tour.cover_image_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Feather name="image" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.ratingPill}>
        <Text style={styles.ratingPillText}>
          ★ {tour.rating.toFixed(1)} ({tour.reviews_count})
        </Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {tour.title}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        👤 {tour.guide.name} ({tour.guide.reviews_count} чел.)
      </Text>
      <TourCardSchedule tourId={tour.id} durationMinutes={tour.duration_minutes} />
      <Text style={styles.price}>
        {tour.price.amount.toLocaleString('ru-RU')} руб.
      </Text>
      <View style={styles.cardActions}>
        <Pressable style={styles.moreBtn} onPress={onDetails}>
          <Text style={styles.moreBtnText}>Подробнее</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Показать тур на карте"
          style={styles.mapBtn}
          onPress={onMap}
        >
          <Feather name="map-pin" size={15} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function TourMapPreview({
  tour,
  onClose,
  onDetails,
}: {
  tour: TourPublic;
  onClose: () => void;
  onDetails: () => void;
}) {
  const meetingPoint = getTourMeetingPoint(tour);
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        {tour.cover_image_url ? (
          <Image source={{ uri: tour.cover_image_url }} style={styles.previewImage} />
        ) : (
          <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
            <Feather name="image" size={20} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.previewBody}>
          <Text style={styles.previewTitle} numberOfLines={1}>
            {tour.title}
          </Text>
          <Text style={styles.previewMeta}>
            ★ {tour.rating.toFixed(1)} ({tour.reviews_count})
          </Text>
          <Text style={styles.previewAddress} numberOfLines={1}>
            {meetingPoint.address}
          </Text>
        </View>
        <Pressable accessibilityLabel="Закрыть карточку" onPress={onClose} hitSlop={8}>
          <Feather name="x" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Text style={styles.previewDescription} numberOfLines={3}>
        {tour.short_description}
      </Text>
      <View style={styles.previewFooter}>
        <Text style={styles.previewPrice}>
          {tour.price.amount.toLocaleString('ru-RU')} руб.
        </Text>
        <Pressable style={styles.previewDetailsBtn} onPress={onDetails}>
          <Text style={styles.previewDetailsBtnText}>Подробнее</Text>
          <Feather name="chevron-right" size={16} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: { fontSize: 32, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  searchWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 16, paddingVertical: 0 },
  segment: {
    borderWidth: 1,
    borderColor: colors.lineSoft,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.white,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.accentButton },
  segmentText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  segmentTextActive: { color: colors.white },
  mapMode: { flex: 1 },
  mapWrap: {
    height: 430,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    backgroundColor: colors.backgroundMuted,
  },
  emptyMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: { marginTop: 8, fontSize: 14, color: colors.errorText },
  listContent: { paddingBottom: 20, rowGap: 14 },
  row: { justifyContent: 'space-between' },
  card: {
    width: '48.5%',
    position: 'relative',
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
  },
  cover: {
    width: '100%',
    height: 84,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
  },
  ratingPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: colors.overlayCard,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '800',
    minHeight: 36,
  },
  meta: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  price: { marginTop: 4, fontSize: 16, color: colors.textPrimary, fontWeight: '800' },
  cardActions: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moreBtn: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  moreBtnText: { color: colors.textPrimary, fontWeight: '700' },
  mapBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  preview: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderColor: colors.line,
    padding: 14,
  },
  previewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewImage: {
    width: 74,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
  },
  previewImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  previewBody: { flex: 1 },
  previewTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  previewMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  previewAddress: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  previewDescription: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 10,
  },
  previewFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewPrice: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  previewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    backgroundColor: colors.accentButton,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  previewDetailsBtnText: { color: colors.white, fontWeight: '800' },
  emptyList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.backgroundMuted,
    padding: 14,
  },
  emptyTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  emptyText: { color: colors.textMuted, marginTop: 4, lineHeight: 19 },
});
