import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { usePreferencesStore } from '../entities/preferences/preferencesStore';
import { matchesAccessibilityPreferences } from '../entities/place/accessibility';
import { usePoes } from '../entities/poe/hooks';
import { poeToPlace } from '../entities/poe/mappers';
import { usePoeFiltersStore } from '../entities/poe/poeUiStore';
import {
  CURRENT_LOCATION_FALLBACK,
  READY_ROUTES,
  getReadyRouteStop,
} from '../entities/route/readyRoutes';
import { useRouteBuilder } from '../entities/route/useRouteBuilder';
import { YandexMap } from '../features/map/YandexMap';
import { recommendPlaces } from '../features/recommendations/recommend';
import type { MainStackParamList } from '../navigation/MainNavigator';
import { extractApiError } from '../shared/api/http';
import { colors } from '../shared/theme/colors';

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

const SEARCH_ALIASES: Record<string, string[]> = {
  арт: ['art', 'arts', 'искусство', 'галерея', 'gallery', 'museum'],
  искусство: ['art', 'arts', 'галерея', 'gallery', 'museum'],
  галерея: ['gallery', 'art', 'arts', 'искусство'],
  музей: ['museum', 'art', 'history', 'история'],
  музеи: ['museum', 'art', 'history', 'история'],
  кофе: ['coffee', 'cafe', 'кафе', 'кофейня'],
  кофейня: ['coffee', 'cafe', 'кафе', 'кофе'],
  кафе: ['coffee', 'cafe', 'кофейня', 'кофе'],
  парк: ['park', 'nature', 'природа', 'сад'],
  сад: ['park', 'nature', 'природа'],
  природа: ['nature', 'park', 'сад'],
  история: ['history', 'historic', 'музей'],
  музыка: ['music', 'club', 'концерт'],
};

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

function matchesPlaceSearchQuery(
  place: {
    name: string;
    description: string;
    address: string;
    categories: string[];
  },
  query: string,
) {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) return true;

  const haystack = [
    place.name,
    place.description,
    place.address,
    ...place.categories,
  ]
    .join(' ')
    .toLowerCase();

  return terms.some((term) => haystack.includes(term));
}

export function MapScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();

  const interests = usePreferencesStore((s) => s.interests);
  const accessibility = usePreferencesStore((s) => s.accessibility);
  const tempo = usePreferencesStore((s) => s.tempo);
  const budgetMin = usePreferencesStore((s) => s.budgetMin);
  const budgetMax = usePreferencesStore((s) => s.budgetMax);
  const durationMinHours = usePreferencesStore((s) => s.durationMinHours);
  const durationMaxHours = usePreferencesStore((s) => s.durationMaxHours);

  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Все шторки старутем свёрнутыми: на первом экране пользователь должен
  // увидеть карту, а не список готовых маршрутов.
  const [readyRoutesExpanded, setReadyRoutesExpanded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  }>(CURRENT_LOCATION_FALLBACK);
  const selectedCategory = usePoeFiltersStore((s) => s.category);
  const wheelchairOnly = usePoeFiltersStore((s) => s.wheelchairOnly);
  const avoidStairsOnly = usePoeFiltersStore((s) => s.avoidStairs);
  const radiusMeters = usePoeFiltersStore((s) => s.radiusMeters);
  const searchActive = submittedQuery.trim().length > 0;

  const tagFilter = interests.join(',');
  // На карту тянем широкий набор точек из API, а ограничения пользователя
  // применяем ниже на фронте. Так можно учесть не только поля API, но и
  // смысловые правила вроде «при проблемах со слухом не предлагать клубы».
  const poeQuery = useMemo(
    () => ({
      city_id: 'ekb',
      category: searchActive ? undefined : selectedCategory ?? undefined,
      tags: searchActive ? undefined : tagFilter || undefined,
      wheelchair_accessible: wheelchairOnly ? true : undefined,
      avoid_stairs: avoidStairsOnly ? true : undefined,
      radius: radiusMeters ?? undefined,
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      page: 1,
      limit: 100,
    }),
    [
      tagFilter,
      searchActive,
      selectedCategory,
      wheelchairOnly,
      avoidStairsOnly,
      radiusMeters,
      currentLocation.lat,
      currentLocation.lng,
    ],
  );
  const poeList = usePoes(poeQuery);
  const routeBuilder = useRouteBuilder();
  const selectedReadyStop = selectedId ? getReadyRouteStop(selectedId) : undefined;
  // POI из API, выбранный кликом по маркеру. Нужен, чтобы показать карточку
  // подробного предпросмотра не только для hardcoded остановок готовых
  // маршрутов, но и для любого реального места.
  const selectedApiPoe = useMemo(() => {
    if (!selectedId) return undefined;
    return poeList.data?.data?.find((item) => item.id === selectedId);
  }, [selectedId, poeList.data?.data]);

  // Сводное «универсальное» представление выбранной точки для нижней карточки.
  // Источник данных: либо реальный POI из API, либо stop готового маршрута.
  const selectedPreview = useMemo(() => {
    if (selectedApiPoe) {
      return {
        id: selectedApiPoe.id,
        title: selectedApiPoe.title,
        description: selectedApiPoe.description,
        address: selectedApiPoe.location.address ?? null,
        rating: selectedApiPoe.rating,
        reviewsCount: selectedApiPoe.reviews_count,
        image: selectedApiPoe.images?.[0],
      };
    }
    if (selectedReadyStop) {
      return {
        id: selectedReadyStop.id,
        title: selectedReadyStop.name,
        description: selectedReadyStop.description,
        address: selectedReadyStop.address,
        rating: selectedReadyStop.rating,
        reviewsCount: selectedReadyStop.reviewsCount,
        image: selectedReadyStop.image,
      };
    }
    return undefined;
  }, [selectedApiPoe, selectedReadyStop]);

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
    if (poeList.data?.data?.length) {
      return poeList.data.data.map(poeToPlace);
    }
    return [];
  }, [poeList.data?.data]);

  const accessibleSourcePlaces = useMemo(
    () =>
      sourcePlaces.filter((place) =>
        matchesAccessibilityPreferences(place, accessibility),
      ),
    [sourcePlaces, accessibility],
  );

  const searchedPlaces = useMemo(() => {
    const q = submittedQuery.trim();
    if (!q) return accessibleSourcePlaces;
    return accessibleSourcePlaces.filter((place) =>
      matchesPlaceSearchQuery(place, q),
    );
  }, [accessibleSourcePlaces, submittedQuery]);

  const recommendations = useMemo(() => {
    const base = recommendPlaces(searchedPlaces, {
      interests,
      accessibility,
      tempo,
      budgetMin,
      budgetMax,
      durationMinHours,
      durationMaxHours,
    });
    const distanceAwareBase =
      radiusMeters != null
        ? {
            ...base,
            items: [...base.items].sort(
              (a, b) =>
                distanceMeters(currentLocation, a.place) -
                distanceMeters(currentLocation, b.place),
            ),
          }
        : base;

    return distanceAwareBase;
  }, [
    searchedPlaces,
    interests,
    accessibility,
    tempo,
    budgetMin,
    budgetMax,
    durationMinHours,
    durationMaxHours,
    radiusMeters,
    currentLocation,
  ]);

  // На карте показываем только реальные POI из API. Готовые маршруты теперь
  // не «активируются» с hardcoded остановками: при нажатии «Продолжить» в
  // шторке мы запускаем настоящую генерацию через useRouteBuilder и сразу
  // ведём пользователя на экран активного маршрута.
  const placesForMap = searchedPlaces;

  const selectedMapPlace = useMemo(() => {
    if (!selectedId) return undefined;
    return placesForMap.find((place) => place.id === selectedId);
  }, [placesForMap, selectedId]);

  const mapCenter = selectedMapPlace
    ? {
        lat: selectedMapPlace.lat,
        lng: selectedMapPlace.lng,
        address: selectedMapPlace.address,
      }
    : currentLocation;

  const searchResults = useMemo(() => {
    return recommendations.items.map(({ place }) => place).slice(0, 8);
  }, [recommendations.items]);

  const loadingInitial = poeList.isLoading && sourcePlaces.length === 0;
  const apiErrorText = poeList.isError ? extractApiError(poeList.error) : null;
  const applySearch = () => {
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    setSelectedId(null);
    if (nextQuery) {
      setReadyRoutesExpanded(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Feather name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={applySearch}
            placeholder="Поиск по местам"
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
        </View>
        <Pressable
          style={styles.filterBtn}
          onPress={() => navigation.navigate('MapFilters')}
        >
          <Feather name="sliders" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        {loadingInitial ? (
          <View style={styles.stateWrap}>
            <ActivityIndicator color={colors.textPrimary} />
            <Text style={styles.stateText}>Загружаем точки на карте...</Text>
          </View>
        ) : (
          <YandexMap
            places={placesForMap}
            selectedId={selectedId}
            onSelect={setSelectedId}
            center={mapCenter}
            currentLocation={currentLocation}
            zoom={13}
          />
        )}
      </View>

      {selectedPreview ? (
        <View style={styles.placePreview}>
          <View style={styles.previewHeader}>
            {selectedPreview.image ? (
              <Image source={{ uri: selectedPreview.image }} style={styles.previewImage} />
            ) : (
              <View style={[styles.previewImage, styles.previewImagePlaceholder]}>
                <Feather name="image" size={20} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.previewBody}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selectedPreview.title}
              </Text>
              <Text style={styles.previewMeta}>
                ★ {selectedPreview.rating.toFixed(1)} ({selectedPreview.reviewsCount})
              </Text>
              {selectedPreview.address ? (
                <Text style={styles.previewAddress} numberOfLines={1}>
                  {selectedPreview.address}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityLabel="Закрыть карточку"
              hitSlop={8}
              style={styles.previewCloseBtn}
              onPress={() => setSelectedId(null)}
            >
              <Feather name="x" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
          {selectedPreview.description ? (
            <Text style={styles.previewDescription} numberOfLines={3}>
              {selectedPreview.description}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={styles.previewDetailsBtn}
            onPress={() =>
              navigation.navigate('PoeDetail', { poeId: selectedPreview.id })
            }
          >
            <Text style={styles.previewDetailsBtnText}>Подробнее</Text>
            <Feather name="chevron-right" size={16} color={colors.white} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.listWrap}>
        {searchActive ? (
          <View style={styles.searchResultsContent}>
            <View style={styles.searchResultsHeader}>
              <View style={styles.searchResultsTitleWrap}>
                <Text style={styles.searchResultsTitle}>Результаты поиска</Text>
                <Text style={styles.searchResultsMeta}>
                  {searchResults.length > 0
                    ? `${searchResults.length} мест по запросу «${submittedQuery}»`
                    : `Ничего не найдено по запросу «${submittedQuery}»`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={styles.clearSearchBtn}
                onPress={() => {
                  setQuery('');
                  setSubmittedQuery('');
                  setSelectedId(null);
                }}
              >
                <Feather name="x" size={16} color={colors.textPrimary} />
              </Pressable>
            </View>
            {searchResults.length > 0 ? (
              searchResults.map((place) => (
                <Pressable
                  key={place.id}
                  style={styles.searchResultRow}
                  onPress={() => setSelectedId(place.id)}
                >
                  <View style={styles.searchResultIcon}>
                    <Feather name="map-pin" size={16} color={colors.white} />
                  </View>
                  <View style={styles.searchResultTextWrap}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>
                      {place.name}
                    </Text>
                    <Text style={styles.searchResultAddress} numberOfLines={1}>
                      {place.address}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.textPrimary} />
                </Pressable>
              ))
            ) : (
              <View style={styles.searchEmptyCard}>
                <Text style={styles.emptyTitle}>Ничего не найдено</Text>
                <Text style={styles.emptyHint}>
                  Попробуйте другой запрос или увеличьте радиус в фильтрах.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.sheetBlock}>
          <Pressable
            style={styles.sheetHeader}
            onPress={() => setReadyRoutesExpanded((value) => !value)}
          >
            <Text style={styles.sheetTitle}>Готовые маршруты</Text>
            <Feather
              name={readyRoutesExpanded ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>
        {readyRoutesExpanded ? (
          <View style={styles.readyRoutesContent}>
            <Text style={styles.readySectionTitle}>Для вас</Text>
            {READY_ROUTES.map((route) => (
              <View key={route.id} style={styles.readyRouteCard}>
                <Text
                  style={[
                    styles.readyStatus,
                    route.status === 'active'
                      ? styles.readyStatusActive
                      : styles.readyStatusPlanned,
                  ]}
                >
                  ● {route.status === 'active' ? 'Можно продолжить' : 'В планах'}
                </Text>
                <Text style={styles.readyRouteTitle}>{route.title}</Text>
                <Text style={styles.readyRouteMeta}>
                  {route.distanceKm.toLocaleString('ru-RU')} км • {route.durationLabel}
                  {route.moodLabel ? ` • ${route.moodLabel}` : ''}
                </Text>
                <Pressable
                  style={[
                    styles.outlineRouteButton,
                    routeBuilder.isBuilding && styles.outlineRouteButtonDisabled,
                  ]}
                  disabled={routeBuilder.isBuilding}
                  onPress={() => {
                    // Раньше открывали hardcoded stops (Plan ART / Simple Coffee).
                    // Теперь это эквивалент «Сгенерировать маршрут» с главного
                    // экрана: подбор по интересам пользователя + переход на
                    // экран активного маршрута.
                    setReadyRoutesExpanded(false);
                    setSelectedId(null);
                    routeBuilder.build({ title: route.title });
                  }}
                >
                  <Text style={styles.outlineRouteButtonText}>
                    {routeBuilder.isBuilding ? 'Подбираем…' : 'Продолжить'}
                  </Text>
                </Pressable>
              </View>
            ))}
            {routeBuilder.error ? (
              <Text style={styles.readyRouteError}>{routeBuilder.error}</Text>
            ) : null}
            {routeBuilder.notice ? (
              <Text style={styles.readyRouteNotice}>{routeBuilder.notice}</Text>
            ) : null}
          </View>
        ) : null}

        {apiErrorText ? (
          <View style={styles.apiHintWrap}>
            <Text style={styles.apiHintTitle}>
              API POE временно недоступен.
            </Text>
            <Text style={styles.apiHintBody}>{apiErrorText}</Text>
          </View>
        ) : null}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
  },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: '#EFE9DF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  listWrap: {
    backgroundColor: colors.white,
    paddingBottom: 10,
  },
  searchResultsContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.backgroundMuted,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  searchResultsHeader: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  searchResultsTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  searchResultsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  searchResultsMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  clearSearchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchResultRow: {
    minHeight: 58,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchResultIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accentButton,
  },
  searchResultTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  searchResultAddress: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSubtle,
  },
  searchEmptyCard: {
    marginTop: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  placePreview: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewImage: {
    width: 58,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.backgroundMuted,
  },
  previewImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBody: {
    flex: 1,
    minWidth: 0,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  previewMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  previewAddress: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSubtle,
  },
  previewDescription: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundMuted,
  },
  previewDetailsBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.accentButton,
  },
  previewDetailsBtnText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '700',
  },
  sheetBlock: {
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  sheetHeader: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  readyRoutesContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: colors.backgroundMuted,
  },
  readySectionTitle: {
    marginBottom: 14,
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  readyRouteCard: {
    marginBottom: 16,
  },
  readyStatus: {
    fontSize: 13,
    color: colors.textSubtle,
  },
  readyStatusActive: {
    color: colors.statusActive,
  },
  readyStatusPlanned: {
    color: colors.statusPlanned,
  },
  readyRouteTitle: {
    marginTop: 6,
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  readyRouteMeta: {
    marginTop: 4,
    fontSize: 15,
    color: colors.textSubtle,
  },
  outlineRouteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  outlineRouteButtonDisabled: {
    opacity: 0.6,
  },
  readyRouteError: {
    marginTop: 8,
    color: colors.errorText,
    fontSize: 12,
  },
  readyRouteNotice: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 12,
  },
  outlineRouteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  routeDetails: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    backgroundColor: colors.backgroundMuted,
  },
  routeListTitle: {
    marginBottom: 14,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  routeStopRow: {
    minHeight: 86,
    marginBottom: 12,
    paddingRight: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeStopName: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.textSubtle,
  },
  routeStopImage: {
    width: 168,
    height: 74,
    borderRadius: 10,
    backgroundColor: colors.backgroundMuted,
  },
  stopRating: {
    position: 'absolute',
    right: 10,
    bottom: 17,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.overlayCard,
  },
  stopRatingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  routeActions: {
    marginTop: 18,
    alignItems: 'center',
    gap: 12,
  },
  primaryRouteButton: {
    minWidth: 166,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.accentButton,
  },
  primaryRouteButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  listHintWarn: {
    color: '#C45C5C',
  },
  listContent: {
    paddingHorizontal: 12,
    gap: 10,
  },
  apiHintWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  apiHintTitle: {
    color: colors.errorText,
    fontSize: 12,
    fontWeight: '700',
  },
  apiHintBody: {
    marginTop: 2,
    color: colors.errorText,
    fontSize: 11,
  },
  card: {
    width: 240,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  cardSelected: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.white,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardAddress: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.line,
  },
  metaText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  cardDescription: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  actionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  actionBtnActive: {
    borderColor: colors.accentButton,
    backgroundColor: colors.accentButton,
  },
  routeAddedBtn: {
    borderColor: colors.accentButton,
    backgroundColor: colors.accentButton,
  },
  actionBtnText: {
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionBtnTextActive: {
    color: colors.white,
  },
  emptyCard: {
    width: 260,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
});
