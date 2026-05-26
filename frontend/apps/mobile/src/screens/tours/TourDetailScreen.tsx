import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Modal,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '../../entities/auth/authStore';
import { localTourToDetail, useGuideModeStore } from '../../entities/guide/guideModeStore';
import { getTourSlotState } from '../../entities/tour/formatSchedule';
import { useToggleTourFavorite } from '../../entities/favorites/hooks';
import { useCreateTourReview, useTour, useTourSlots } from '../../entities/tour/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { TourAccessibilitySection } from '../../features/tour/TourAccessibilitySection';
import { TourScheduleSection } from '../../features/tour/TourScheduleSection';
import { extractApiError } from '../../shared/api/http';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { colors } from '../../shared/theme/colors';

type Props = NativeStackScreenProps<MainStackParamList, 'TourDetail'>;

export function TourDetailScreen({ route, navigation }: Props) {
  const { tourId, bookingId } = route.params;
  const user = useAuthStore((s) => s.user);
  const localTour = useGuideModeStore((s) => s.tours.find((item) => item.id === tourId));
  const tour = useTour(tourId);
  const tourSlots = useTourSlots(localTour ? null : tourId);
  const queryClient = useQueryClient();
  const createReview = useCreateTourReview();
  const tourFavorite = useToggleTourFavorite(tourId);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState('5');

  const guideName = user
    ? [user.name, user.surname].filter(Boolean).join(' ').trim() || user.email
    : 'Фамилия Имя';
  const tourData = tour.data ?? (localTour ? localTourToDetail(localTour, guideName) : null);
  const scheduleSlots = localTour?.slotStartsAt
    ? [{ starts_at: localTour.slotStartsAt }]
    : tourSlots.data;
  const slotState = tourData ? getTourSlotState(scheduleSlots, tourData.duration_minutes) : null;
  const canBook = slotState?.status === 'upcoming';
  const bookLabel =
    slotState?.status === 'active'
      ? 'Тур уже идет'
      : slotState?.status === 'ended'
        ? 'Тур прошел'
        : 'Забронировать';

  if (tour.isLoading && !tourData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }
  if (!tourData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{extractApiError(tour.error)}</Text>
      </View>
    );
  }

  const canSubmitReview = Boolean(bookingId && reviewText.trim().length >= 8 && Number(reviewRating) >= 1 && Number(reviewRating) <= 5);
  const ratingLabel = `${tourData.rating.toFixed(1).replace('.', ',')} (${tourData.reviews_count} отзывов)`;
  const guideLabel = tourData.guide.bio
    ? `${tourData.guide.name} - ${tourData.guide.bio}`
    : tourData.guide.name;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <View style={styles.heroWrap}>
        {tourData.images[0] || tourData.guide.avatar_url ? (
          <Image source={{ uri: tourData.images[0] ?? (tourData.guide.avatar_url as string) }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroPh]} />
        )}
        <LinearGradient
          colors={['rgba(29, 46, 76, 0.15)', 'transparent', 'rgba(29, 46, 76, 0.82)']}
          locations={[0, 0.35, 1]}
          style={styles.heroGradient}
        />
        {!localTour ? (
          <Pressable
            style={styles.favBadge}
            accessibilityRole="button"
            accessibilityLabel={
              tourFavorite.isFavorite ? 'Убрать из избранного' : 'В избранное'
            }
            disabled={tourFavorite.isPending}
            onPress={() => tourFavorite.toggleFavorite(tourData.title)}
          >
            <Feather
              name="heart"
              size={22}
              color={tourFavorite.isFavorite ? '#FF8A8A' : colors.white}
            />
          </Pressable>
        ) : null}
        <View style={styles.priceBadge}>
          <Text style={styles.heroPrice}>
            {tourData.price.amount.toLocaleString('ru-RU')} руб.
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{tourData.title}</Text>
      <Text style={styles.description}>{tourData.description}</Text>

      <View style={styles.metaList}>
        <Pressable
          style={({ pressed }) => [styles.metaRow, styles.metaRowLink, pressed && styles.metaRowPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Профиль гида ${tourData.guide.name}`}
          onPress={() =>
            navigation.navigate('GuideProfile', {
              guideId: tourData.guide.id,
              tourId,
            })
          }
        >
          <Feather name="user" size={18} color={colors.accentDeep} style={styles.metaIconLink} />
          <View style={styles.metaTextWrap}>
            <Text style={styles.metaTextLink}>{guideLabel}</Text>
            <Text style={styles.metaLinkHint}>Профиль гида</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
        <View style={styles.metaRow}>
          <Feather name="users" size={18} color={colors.textPrimary} style={styles.metaIcon} />
          <Text style={styles.metaText}>Группы до {tourData.group_size_max} человек</Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={18} color={colors.textPrimary} style={styles.metaIcon} />
          <Text style={styles.metaText}>
            {tourData.meeting_point.address ?? 'Начало в центре города'}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.metaRow, styles.metaRowLink, pressed && styles.metaRowPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Отзывы тура, ${ratingLabel}`}
          onPress={() => navigation.navigate('TourReviews', { tourId })}
        >
          <Feather name="star" size={18} color={colors.starYellow} style={styles.metaIconLink} />
          <Text style={[styles.metaText, styles.metaTextFlex]}>{ratingLabel}</Text>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
      {bookingId ? (
        <Pressable style={styles.reviewBtn} onPress={() => setReviewOpen(true)}>
          <Text style={styles.reviewBtnText}>Оставить отзыв по брони</Text>
        </Pressable>
      ) : null}

      <Text style={styles.sectionHeading}>Расписание и доступность</Text>
      <TourScheduleSection
        durationMinutes={tourData.duration_minutes}
        slots={scheduleSlots}
        fallbackSchedule={
          localTour && !localTour.slotStartsAt ? localTour.scheduleLabel : undefined
        }
        isLoading={!localTour && tourSlots.isLoading}
        title="Расписание"
      />
      <TourAccessibilitySection
        accessibility={tourData.accessibility}
        tags={tourData.tags}
        title="Доступность"
      />

      <Pressable
        style={[styles.bookBtn, !canBook && styles.bookBtnDisabled]}
        disabled={!canBook}
        onPress={() => navigation.navigate('TourBooking', { tourId })}
      >
        <Text style={styles.bookBtnText}>{bookLabel}</Text>
      </Pressable>

      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => setReviewOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setReviewOpen(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>Новый отзыв</Text>
            <TextInput
              value={reviewRating}
              onChangeText={(value) => setReviewRating(value.replace(/[^0-9]/g, '').slice(0, 1))}
              keyboardType="number-pad"
              placeholder="Оценка 1..5"
              style={styles.modalInput}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Опишите впечатления от тура"
              style={[styles.modalInput, styles.modalTextarea]}
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <Pressable
              style={[styles.modalSubmit, (!canSubmitReview || createReview.isPending) && styles.disabledBtn]}
              disabled={!canSubmitReview || createReview.isPending}
              onPress={async () => {
                if (!bookingId) return;
                await createReview.mutateAsync({
                  tourId,
                  bookingId,
                  rating: Number(reviewRating),
                  text: reviewText.trim(),
                });
                await queryClient.invalidateQueries({ queryKey: ['tours', 'detail', tourId] });
                await queryClient.invalidateQueries({ queryKey: ['tours', 'reviews', tourId] });
                setReviewOpen(false);
                setReviewText('');
                setReviewRating('5');
              }}
            >
              <Text style={styles.modalSubmitText}>Отправить отзыв</Text>
            </Pressable>
            {createReview.isError ? (
              <Text style={styles.errorText}>{extractApiError(createReview.error)}</Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroWrap: { marginTop: 6, position: 'relative', borderRadius: 14, overflow: 'hidden' },
  hero: { width: '100%', height: 200, backgroundColor: colors.line },
  heroPh: { backgroundColor: '#798172' },
  heroGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  favBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  priceBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    maxWidth: '78%',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.overlayCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroPrice: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    marginTop: 16,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  description: {
    marginTop: 10,
    fontSize: 16,
    color: colors.textPrimary,
    lineHeight: 24,
    fontWeight: '600',
  },
  sectionHeading: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  metaList: { marginTop: 14, gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  metaRowLink: {
    alignItems: 'center',
    marginHorizontal: -6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  metaRowPressed: { opacity: 0.72, backgroundColor: 'rgba(113, 131, 106, 0.12)' },
  metaIcon: { marginTop: 2 },
  metaIconLink: { marginTop: 0 },
  metaTextWrap: { flex: 1, minWidth: 0 },
  metaText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  metaTextFlex: { flex: 1, minWidth: 0 },
  metaTextLink: {
    color: colors.accentDeep,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  metaLinkHint: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.white,
  },
  reviewBtnText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  bookBtn: {
    marginTop: 20,
    alignSelf: 'center',
    minWidth: '72%',
    backgroundColor: colors.accentButton,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bookBtnDisabled: { opacity: 0.72 },
  bookBtnText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  modalTextarea: { minHeight: 88, textAlignVertical: 'top' },
  modalSubmit: {
    marginTop: 4,
    backgroundColor: colors.accentButton,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalSubmitText: { color: colors.white, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },
  errorText: { color: colors.errorText, fontSize: 12, marginBottom: 8 },
});
