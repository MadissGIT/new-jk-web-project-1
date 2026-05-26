import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useGuideReviews, useGuideStats } from '../../entities/guide/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { Stars } from '../../shared/ui/Stars';

type Props = NativeStackScreenProps<MainStackParamList, 'GuideReviews'>;

export function GuideReviewsScreen(_props: Props) {
  const reviews = useGuideReviews();
  const guideStats = useGuideStats();

  const items = reviews.data?.data ?? [];
  const reviewsTotal = reviews.data?.meta?.total ?? items.length;
  const avgRating = guideStats.data?.avg_rating ?? 0;
  const hasRating = reviewsTotal > 0 && avgRating > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Text style={styles.title}>Отзывы</Text>
      <Text style={styles.score}>
        {hasRating
          ? `⭐ ${avgRating.toFixed(1).replace('.', ',')} (${reviewsTotal} отзывов)`
          : 'Пока без отзывов'}
      </Text>

      {reviews.isLoading || guideStats.isLoading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : null}
      {reviews.isError ? (
        <Text style={styles.errorText}>{extractApiError(reviews.error)}</Text>
      ) : null}
      {items.length === 0 && !reviews.isLoading ? (
        <Text style={styles.emptyText}>Отзывов от туристов пока нет</Text>
      ) : null}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardAuthor}>{item.user.name}</Text>
          <View style={styles.stars}>
            <Stars value={item.rating} />
          </View>
          <Text style={styles.body}>{item.text}</Text>
          <Text style={styles.meta}>
            {new Date(item.created_at).toLocaleDateString('ru-RU')}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 30 },
  title: {
    marginTop: 8,
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 32,
  },
  score: { marginTop: 8, color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  card: {
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
  },
  cardAuthor: { color: colors.textPrimary, fontWeight: '800', fontSize: 16 },
  stars: { marginTop: 6 },
  body: { marginTop: 8, color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  meta: { marginTop: 8, color: colors.textMuted, fontSize: 12 },
  errorText: { marginTop: 12, color: colors.errorText, fontSize: 13 },
  emptyText: { marginTop: 12, color: colors.textMuted, fontSize: 14 },
});
