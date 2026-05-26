import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFavoritesQuery } from '../../entities/favorites/hooks';
import { fetchPoeDetail } from '../../entities/poe/api';
import { fetchTour } from '../../entities/tour/api';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { colors } from '../../shared/theme/colors';

type FavouriteCardItem = {
  id: string;
  kind: 'poe' | 'tour';
  title: string;
  image?: string;
  subtitle: string;
  rating: number;
  reviewsCount: number;
};

export function ProfileFavouritesScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const favorites = useFavoritesQuery();

  const poeIds = useMemo(
    () => favorites.data?.poes.map((item) => item.id) ?? [],
    [favorites.data?.poes],
  );
  const tourIds = useMemo(
    () => favorites.data?.tours.map((item) => item.id) ?? [],
    [favorites.data?.tours],
  );

  const poeDetails = useQueries({
    queries: poeIds.map((id) => ({
      queryKey: ['poe', 'detail', id, 'favorites'],
      queryFn: () => fetchPoeDetail(id),
      enabled: Boolean(id),
      staleTime: 60_000,
    })),
  });

  const tourDetails = useQueries({
    queries: tourIds.map((id) => ({
      queryKey: ['tours', 'detail', id, 'favorites'],
      queryFn: () => fetchTour(id),
      enabled: Boolean(id),
      staleTime: 60_000,
    })),
  });

  const items = useMemo((): FavouriteCardItem[] => {
    const poeItems = poeDetails
      .map<FavouriteCardItem | null>((query, index) => {
        const poe = query.data;
        const fallback = favorites.data?.poes[index];
        if (!poe && !fallback) return null;
        return {
          id: poe?.id ?? fallback!.id,
          kind: 'poe' as const,
          title: poe?.title ?? fallback!.title,
          image: poe?.images[0],
          subtitle: poe?.location.address ?? 'Адрес не указан',
          rating: poe?.rating ?? 0,
          reviewsCount: poe?.reviews_count ?? 0,
        };
      })
      .filter((item): item is FavouriteCardItem => item !== null);

    const tourItems = tourDetails
      .map<FavouriteCardItem | null>((query, index) => {
        const tour = query.data;
        const fallback = favorites.data?.tours[index];
        if (!tour && !fallback) return null;
        return {
          id: tour?.id ?? fallback!.id,
          kind: 'tour' as const,
          title: tour?.title ?? fallback!.title,
          image: tour?.images[0] ?? tour?.cover_image_url ?? undefined,
          subtitle: tour?.meeting_point.address ?? 'Место встречи уточняется',
          rating: tour?.rating ?? 0,
          reviewsCount: tour?.reviews_count ?? 0,
        };
      })
      .filter((item): item is FavouriteCardItem => item !== null);

    return [...tourItems, ...poeItems] as FavouriteCardItem[];
  }, [favorites.data?.poes, favorites.data?.tours, poeDetails, tourDetails]);

  const isLoadingDetails =
    favorites.isLoading ||
    (items.length === 0 &&
      (poeDetails.some((q) => q.isLoading) || tourDetails.some((q) => q.isLoading)));

  return (
    <View style={styles.flex}>
      <FlatList
        data={items}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <ScreenHeader />
            <Text style={styles.title}>Избранное</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            {isLoadingDetails ? (
              <>
                <ActivityIndicator color={colors.textPrimary} />
                <Text style={styles.emptyTitle}>Загружаем избранное...</Text>
              </>
            ) : (
              <>
                <Feather name="heart" size={30} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>В избранном пока пусто</Text>
                <Text style={styles.emptyText}>
                  Добавляйте туры и места с карточек «Подробнее».
                </Text>
                {favorites.isError ? (
                  <Text style={styles.errorText}>{extractApiError(favorites.error)}</Text>
                ) : null}
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FavouriteCard
            item={item}
            onPress={() =>
              item.kind === 'tour'
                ? navigation.navigate('TourDetail', { tourId: item.id })
                : navigation.navigate('PoeDetail', { poeId: item.id })
            }
          />
        )}
      />
    </View>
  );
}

function FavouriteCard({
  item,
  onPress,
}: {
  item: FavouriteCardItem;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      {item.image ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.image }} style={styles.image} />
          <View style={styles.ratingPill}>
            <Feather name="star" size={10} color={colors.white} />
            <Text style={styles.ratingText}>
              {item.rating.toFixed(1)} ({item.reviewsCount})
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.imageWrap, styles.imagePlaceholder]}>
          <Feather name="image" size={22} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.kindLabel}>{item.kind === 'tour' ? 'Тур' : 'Место'}</Text>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.metaRow}>
        <Feather name="map-pin" size={12} color={colors.textMuted} />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <Pressable style={styles.moreBtn} onPress={onPress}>
        <Text style={styles.moreBtnText}>Подробнее</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  imageWrap: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
    height: 100,
    backgroundColor: colors.line,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ratingPill: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.overlayCard,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 16,
    minHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  moreBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
  },
  moreBtnText: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  emptyWrap: {
    minHeight: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    color: colors.errorText,
    textAlign: 'center',
  },
});
