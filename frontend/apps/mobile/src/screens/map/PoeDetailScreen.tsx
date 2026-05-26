import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { createPoeReview } from '../../entities/poe/api';
import { useIsFavorite, useTogglePoeFavorite } from '../../entities/favorites/hooks';
import { usePoeDetail, usePoeReviews } from '../../entities/poe/hooks';
import { getLocalRoutePoeDetail } from '../../entities/route/localRouteGenerator';
import { useRouteDraftStore } from '../../entities/route/routeDraftStore';
import { getReadyRoutePoeDetail, getReadyRouteStop } from '../../entities/route/readyRoutes';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { SaveButton } from '../../shared/ui/SaveButton';
import { Stars } from '../../shared/ui/Stars';
import { colors } from '../../shared/theme/colors';

const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Пн', monday: 'Пн',
  tue: 'Вт', tuesday: 'Вт',
  wed: 'Ср', wednesday: 'Ср',
  thu: 'Чт', thursday: 'Чт',
  fri: 'Пт', friday: 'Пт',
  sat: 'Сб', saturday: 'Сб',
  sun: 'Вс', sunday: 'Вс',
};

function formatWeekday(day: string): string {
  return WEEKDAY_LABELS[day.toLowerCase()] ?? day;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Props = NativeStackScreenProps<MainStackParamList, 'PoeDetail'>;

export function PoeDetailScreen({ route }: Props) {
  const { poeId } = route.params;
  const detail = usePoeDetail(poeId);
  const reviews = usePoeReviews(poeId);
  const readyRouteStop = getReadyRouteStop(poeId);
  const readyRouteDetail = getReadyRoutePoeDetail(poeId);
  const localRouteDetail = getLocalRoutePoeDetail(poeId);
  const toggleFavourite = useTogglePoeFavorite();
  const isFav = useIsFavorite('poe', poeId);
  const addRoutePoint = useRouteDraftStore((s) => s.addPoint);
  const hasRoutePoint = useRouteDraftStore((s) => s.hasPoint);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [heroFailed, setHeroFailed] = useState(false);
  const [failedGalleryUrls, setFailedGalleryUrls] = useState<Record<string, boolean>>({});

  const review = useMutation({
    mutationFn: async () =>
      createPoeReview(poeId, {
        rating,
        text: reviewText.trim(),
      }),
    onSuccess: () => {
      setReviewText('');
      setInlineError(null);
      // Освежаем и список отзывов, и карточку (изменится avg rating).
      queryClient.invalidateQueries({ queryKey: ['poe', 'reviews', poeId] });
      queryClient.invalidateQueries({ queryKey: ['poe', 'detail', poeId] });
    },
    onError: (error) => {
      setInlineError(extractApiError(error));
    },
  });

  const poe = detail.data ?? readyRouteDetail ?? localRouteDetail;
  const images = useMemo(() => poe?.images?.filter(Boolean) ?? [], [poe?.images]);
  const heroImage = !heroFailed ? images[0] : undefined;
  const galleryImages = useMemo(
    () => images.slice(1).filter((uri) => !failedGalleryUrls[uri]),
    [images, failedGalleryUrls],
  );

  // Кнопки превращаем в стабильные коллбэки: одна из жалоб пользователя
  // — «В избранное» не срабатывает с первого клика. Стабильная ссылка на
  // обработчик исключает рейс-кондишены ререндера + используем TouchableOpacity
  // с явным hitSlop, чтобы touch-зона была шире.
  const onPressFavorite = useCallback(() => {
    if (!poe || toggleFavourite.isPending) return;
    toggleFavourite.mutate(poe.id, poe.title);
  }, [poe, toggleFavourite]);

  const onPressAddToRoute = useCallback(() => {
    if (!poe) return;
    addRoutePoint(poe.id);
  }, [poe, addRoutePoint]);

  const onHeroError = useCallback(() => setHeroFailed(true), []);
  const onGalleryError = useCallback(
    (uri: string) =>
      setFailedGalleryUrls((current) => ({ ...current, [uri]: true })),
    [],
  );

  if (detail.isLoading && !readyRouteDetail && !localRouteDetail) {
    return (
      <View style={styles.rootLoading}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (!poe) {
    return (
      <View style={styles.rootLoading}>
        <Text style={styles.errorTitle}>Не удалось загрузить карточку POE</Text>
        <Text style={styles.errorBody}>{extractApiError(detail.error)}</Text>
      </View>
    );
  }

  const isInRoute = hasRoutePoint(poe.id);
  const reviewsCount = reviews.data?.meta?.total ?? poe.reviews_count;
  const reviewsItems = reviews.data?.data ?? [];

  const openingHours = (poe as { opening_hours?: { day: string; from: string; to: string }[] })
    .opening_hours;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader />
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={styles.hero}
            resizeMode="cover"
            onError={onHeroError}
          />
        ) : (
          <View style={[styles.hero, styles.heroPlaceholder]}>
            <Feather name="image" size={30} color={colors.textMuted} />
            <Text style={styles.heroPlaceholderText}>
              {images.length > 0 ? 'Не удалось загрузить фото' : 'Фото не добавлено'}
            </Text>
          </View>
        )}
        {galleryImages.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gallery}
          >
            {galleryImages.map((uri) => (
              <Image
                key={uri}
                source={{ uri }}
                style={styles.galleryItem}
                resizeMode="cover"
                onError={() => onGalleryError(uri)}
              />
            ))}
          </ScrollView>
        ) : null}
        <Text style={styles.title}>{poe.title}</Text>
        <Text style={styles.meta}>{poe.location.address ?? 'Адрес не указан'}</Text>
        <View style={styles.ratingRow}>
          <Stars value={poe.rating} />
          <Text style={styles.meta}>
            {poe.rating.toFixed(1)} ({reviewsCount})
          </Text>
        </View>
        <Text style={styles.description}>{poe.description}</Text>

        <View style={styles.metaInlineWrap}>
          {poe.duration_minutes ? (
            <View style={styles.metaInlineRow}>
              <Feather name="clock" size={15} color={colors.textPrimary} />
              <Text style={styles.metaInlineText}>
                Посещение ≈ {poe.duration_minutes} мин
              </Text>
            </View>
          ) : null}
          {poe.category ? (
            <View style={styles.metaInlineRow}>
              <Feather name="tag" size={15} color={colors.textPrimary} />
              <Text style={styles.metaInlineText}>{poe.category}</Text>
            </View>
          ) : null}
        </View>

        {readyRouteStop ? (
          <View style={styles.contactsWrap}>
            {readyRouteStop.website ? (
              <View style={styles.contactRow}>
                <Feather name="globe" size={19} color={colors.textPrimary} />
                <Text style={styles.contactText}>{readyRouteStop.website}</Text>
              </View>
            ) : null}
            {readyRouteStop.phone ? (
              <View style={styles.contactRow}>
                <Feather name="phone" size={19} color={colors.textPrimary} />
                <Text style={styles.contactText}>{readyRouteStop.phone}</Text>
              </View>
            ) : null}
            {readyRouteStop.hoursLabel ? (
              <View style={styles.contactRow}>
                <Feather name="clock" size={19} color={colors.textPrimary} />
                <Text style={styles.contactText}>{readyRouteStop.hoursLabel}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {openingHours && openingHours.length ? (
          <View style={styles.hoursBlock}>
            <Text style={styles.blockTitle}>Часы работы</Text>
            {openingHours.map((item) => (
              <View key={`${item.day}-${item.from}-${item.to}`} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{formatWeekday(item.day)}</Text>
                <Text style={styles.hoursValue}>
                  {item.from} – {item.to}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.tagsWrap}>
          {poe.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.accessWrap}>
          <Text style={styles.blockTitle}>Доступность</Text>
          <Text style={styles.meta}>
            {poe.accessibility.wheelchair_accessible ? '✓ Коляска' : '— Нет условий для коляски'}
          </Text>
          <Text style={styles.meta}>{poe.accessibility.has_ramp ? '✓ Есть пандус' : '— Пандуса нет'}</Text>
          <Text style={styles.meta}>{poe.accessibility.has_stairs ? '⚠ Есть лестницы' : '✓ Без лестниц'}</Text>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            disabled={toggleFavourite.isPending}
            onPress={onPressFavorite}
            style={[styles.actionBtn, isFav && styles.actionBtnPrimary]}
          >
            <Text style={[styles.actionText, isFav && styles.actionTextPrimary]}>
              {isFav ? 'В избранном' : 'В избранное'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            onPress={onPressAddToRoute}
            style={[styles.actionBtn, isInRoute && styles.actionBtnPrimary]}
          >
            <Text style={[styles.actionText, isInRoute && styles.actionTextPrimary]}>
              {isInRoute ? 'В маршруте' : 'В маршрут'}
            </Text>
          </TouchableOpacity>
        </View>

        {!readyRouteStop ? (
          <View style={styles.reviewBlock}>
            <Text style={styles.blockTitle}>Оставить отзыв</Text>
            <View style={styles.scoreRow}>
              {[1, 2, 3, 4, 5].map((v) => (
                <TouchableOpacity
                  key={v}
                  activeOpacity={0.7}
                  onPress={() => setRating(v)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                >
                  <Feather
                    name="star"
                    size={22}
                    color={v <= rating ? colors.starYellow : colors.lineSoft}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              placeholder="Ваш отзыв"
              placeholderTextColor={colors.textMuted}
            />
            {inlineError ? <Text style={styles.inlineError}>{inlineError}</Text> : null}
            <SaveButton
              title="Отправить отзыв"
              onPress={() => review.mutate()}
              disabled={!reviewText.trim()}
              loading={review.isPending}
            />
          </View>
        ) : null}

        <View style={styles.reviewsBlock}>
          <Text style={styles.blockTitle}>
            Отзывы посетителей{reviewsCount ? ` (${reviewsCount})` : ''}
          </Text>
          {reviews.isLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : reviewsItems.length ? (
            reviewsItems.map((item) => (
              <View key={item.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewAuthor}>{item.user.name || 'Гость'}</Text>
                  <Text style={styles.reviewDate}>{formatRelativeDate(item.created_at)}</Text>
                </View>
                <View style={styles.reviewStars}>
                  <Stars value={item.rating} />
                </View>
                <Text style={styles.reviewText}>{item.text}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.meta}>
              Здесь пока пусто. Станьте первым, кто оставит отзыв.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rootLoading: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 28 },
  hero: { width: '100%', height: 160, borderRadius: 12, marginBottom: 12 },
  heroPlaceholder: {
    backgroundColor: colors.backgroundMuted,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  heroPlaceholderText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gallery: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
    marginBottom: 12,
  },
  galleryItem: {
    width: 96,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.backgroundMuted,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  meta: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  tagsWrap: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  contactsWrap: { marginTop: 14, gap: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactText: { fontSize: 15, color: colors.textSubtle, textDecorationLine: 'underline' },
  tag: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  tagText: { fontSize: 12, color: colors.textPrimary },
  accessWrap: { marginTop: 14, gap: 2 },
  blockTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  actionsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  actionBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  actionBtnPrimary: {
    borderColor: colors.accentButton,
    backgroundColor: colors.accentButton,
  },
  actionText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  actionTextPrimary: { color: colors.white },
  reviewBlock: { marginTop: 18, gap: 10 },
  scoreRow: { flexDirection: 'row', gap: 6 },
  reviewInput: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 10,
    minHeight: 90,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  inlineError: { color: colors.errorText, fontSize: 12, marginTop: -4 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  errorBody: { marginTop: 4, fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  metaInlineWrap: {
    marginTop: 12,
    gap: 6,
  },
  metaInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaInlineText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  hoursBlock: {
    marginTop: 14,
    gap: 4,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  hoursDay: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  hoursValue: {
    fontSize: 13,
    color: colors.textMuted,
  },
  reviewsBlock: {
    marginTop: 18,
    gap: 10,
  },
  reviewItem: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.white,
    padding: 12,
    gap: 6,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewText: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
});
