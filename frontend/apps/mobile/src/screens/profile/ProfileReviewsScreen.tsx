import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeleteMyReview, useMyReviews } from '../../entities/review/hooks';
import type { ReviewPublic } from '../../entities/review/types';
import { extractApiError } from '../../shared/api/http';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { Stars } from '../../shared/ui/Stars';
import { colors } from '../../shared/theme/colors';

function formatReviewDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function entityKindLabel(entityType?: ReviewPublic['entity_type']) {
  if (entityType === 'tour') return 'Тур';
  if (entityType === 'poe') return 'Место';
  return 'Объект';
}

export function ProfileReviewsScreen() {
  const reviews = useMyReviews();
  const deleteReview = useDeleteMyReview();

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader />
        <Text style={styles.title}>Отзывы</Text>

        {reviews.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.textPrimary} />
          </View>
        ) : null}

        {reviews.isError ? (
          <Text style={styles.errorText}>{extractApiError(reviews.error)}</Text>
        ) : null}

        <View style={styles.list}>
          {(reviews.data?.data ?? []).map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              onDelete={() => deleteReview.mutate(item.id)}
              isDeleting={deleteReview.isPending}
            />
          ))}
        </View>

        {!reviews.isLoading && (reviews.data?.data.length ?? 0) === 0 ? (
          <Text style={styles.emptyText}>
            Вы ещё не оставляли отзывов. Они появятся здесь после оценки тура или места.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const COLLAPSED_LENGTH = 120;

function ReviewCard({
  item,
  onDelete,
  isDeleting,
}: {
  item: ReviewPublic;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const needTruncate = item.text.length > COLLAPSED_LENGTH;
  const visibleText =
    !needTruncate || expanded
      ? item.text
      : `${item.text.slice(0, COLLAPSED_LENGTH).trim()}…`;

  return (
    <View style={styles.card}>
      <Text style={styles.kind}>{entityKindLabel(item.entity_type)}</Text>
      <Text style={styles.cardTitle}>
        {item.entity_title?.trim() || 'Без названия'}
      </Text>
      <Text style={styles.date}>{formatReviewDate(item.created_at)}</Text>
      <View style={styles.stars}>
        <Stars value={item.rating} />
      </View>
      <Text style={styles.text}>
        {visibleText}
        {needTruncate ? (
          <Text style={styles.moreLink} onPress={() => setExpanded((v) => !v)}>
            {expanded ? ' свернуть' : ' ещё'}
          </Text>
        ) : null}
      </Text>
      <Pressable
        style={[styles.deleteBtn, isDeleting && styles.deleteBtnDisabled]}
        disabled={isDeleting}
        onPress={onDelete}
      >
        <Text style={styles.deleteBtnText}>Удалить</Text>
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
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14,
  },
  kind: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  cardTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },
  stars: {
    marginTop: 6,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  moreLink: {
    color: colors.textSubtle,
    fontWeight: '600',
  },
  deleteBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.errorText,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.errorText,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.errorText,
  },
});
