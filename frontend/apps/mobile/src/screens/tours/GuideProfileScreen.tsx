import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { GuidePublicProfile } from '../../entities/guide/api';
import { useGuidePublicProfile } from '../../entities/guide/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';

type Props = NativeStackScreenProps<MainStackParamList, 'GuideProfile'>;

function splitSpecializations(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,;|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatContactLines(guide: GuidePublicProfile): string[] {
  const lines: string[] = [];
  if (guide.email) lines.push(guide.email);
  if (guide.contacts) {
    const looksLikeHandle =
      guide.contacts.includes('@') ||
      guide.contacts.toLowerCase().includes('t.me') ||
      /^@/.test(guide.contacts.trim());
    lines.push(looksLikeHandle ? `TG: ${guide.contacts.replace(/^@/, '')}` : guide.contacts);
  } else if (guide.phone) {
    lines.push(guide.phone);
  }
  return lines;
}

function InfoSection({
  icon,
  title,
  lines,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  lines: string[];
}) {
  if (!lines.length) return null;
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoSectionTitle}>
        <Feather name={icon} size={18} color={colors.textPrimary} />
        <Text style={styles.infoSectionHeading}>{title}</Text>
      </View>
      {lines.map((line) => (
        <Text key={line} style={styles.infoLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export function GuideProfileScreen({ route, navigation }: Props) {
  const { guideId, tourId } = route.params;
  const profile = useGuidePublicProfile(guideId);

  if (profile.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{extractApiError(profile.error)}</Text>
      </View>
    );
  }

  const guide = profile.data;
  const specializations = splitSpecializations(guide.specialization);
  const contactLines = formatContactLines(guide);
  const languageLine =
    guide.languages.length > 0
      ? guide.languages.join(' / ')
      : '';
  const experienceLines = [
    guide.experience > 0 ? `${guide.experience} лет в сфере` : null,
    guide.tours_count > 0 ? `${guide.tours_count}+ туров` : null,
  ].filter((line): line is string => Boolean(line));

  const handleWrite = () => {
    if (guide.contacts?.includes('@') || guide.contacts?.toLowerCase().includes('t.me')) {
      void Linking.openURL(`mailto:${guide.email}`).catch(() => undefined);
      return;
    }
    if (guide.phone) {
      void Linking.openURL(`tel:${guide.phone}`).catch(() => undefined);
      return;
    }
    void Linking.openURL(`mailto:${guide.email}`).catch(() => undefined);
  };

  const bioText =
    guide.bio.trim() ||
    'Гид пока не добавил описание. Скоро здесь появится рассказ о стиле прогулок и любимых маршрутах.';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />

      <View style={styles.profileRow}>
        {guide.avatar ? (
          <Image source={{ uri: guide.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPh]}>
            <Feather name="user" size={44} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.profileMeta}>
          <Text style={styles.name}>{guide.name}</Text>
          {contactLines.map((line) => (
            <Text key={line} style={styles.mutedText}>
              {line}
            </Text>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              // В макете рейтинг подчёркнут — ведём на туры гида или первый тур.
              const targetTourId = guide.tours[0]?.id ?? tourId;
              if (targetTourId) {
                navigation.navigate('TourReviews', { tourId: targetTourId });
              }
            }}
          >
            <View style={styles.ratingRow}>
              <Feather name="star" size={14} color={colors.textPrimary} />
              <Text style={styles.ratingText}>
                {guide.reviews_count > 0
                  ? `${guide.rating.toFixed(1)} (${guide.reviews_count} отзывов)`
                  : 'пока нет отзывов'}
              </Text>
            </View>
          </Pressable>
          <Pressable style={styles.msgBtn} onPress={handleWrite} accessibilityRole="button">
            <Text style={styles.msgText}>Написать</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.bioText}>{bioText}</Text>

      <InfoSection icon="award" title="Специализации" lines={specializations} />
      <InfoSection
        icon="globe"
        title="Языки"
        lines={languageLine ? [languageLine] : []}
      />
      <InfoSection icon="users" title="Опыт" lines={experienceLines} />

      <Text style={styles.toursTitle}>Туры гида</Text>
      {guide.tours.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toursRow}
        >
          {guide.tours.map((tour) => (
            <Pressable
              key={tour.id}
              style={styles.tourCard}
              onPress={() => navigation.navigate('TourDetail', { tourId: tour.id })}
            >
              {tour.cover_image_url ? (
                <Image source={{ uri: tour.cover_image_url }} style={styles.tourImage} />
              ) : (
                <View style={[styles.tourImage, styles.tourImagePh]}>
                  <Feather name="image" size={28} color={colors.textMuted} />
                </View>
              )}
              <Text style={styles.tourCardTitle} numberOfLines={2}>
                {tour.title}
              </Text>
              <Text style={styles.tourCardMeta}>
                {tour.rating.toFixed(1)} · {tour.reviews_count} отзывов
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : tourId ? (
        <Pressable
          style={styles.outlineBtn}
          onPress={() => navigation.navigate('TourDetail', { tourId })}
        >
          <Text style={styles.outlineBtnText}>Открыть тур</Text>
        </Pressable>
      ) : (
        <Text style={styles.emptyTours}>У гида пока нет опубликованных туров.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: { color: colors.errorText, textAlign: 'center' },
  profileRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 16,
  },
  avatar: {
    width: 120,
    height: 156,
    borderRadius: 8,
    backgroundColor: colors.line,
  },
  avatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMeta: {
    flex: 1,
    gap: 7,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  mutedText: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ratingText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  msgBtn: {
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: colors.accentButton,
    paddingVertical: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  msgText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  bioText: {
    marginTop: 22,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'justify',
    fontWeight: '700',
  },
  infoSection: {
    marginTop: 22,
  },
  infoSectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  infoSectionHeading: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  infoLine: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  toursTitle: {
    marginTop: 28,
    marginBottom: 12,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  toursRow: {
    gap: 12,
    paddingRight: 8,
  },
  tourCard: {
    width: 148,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  tourImage: {
    width: '100%',
    height: 100,
    backgroundColor: colors.line,
  },
  tourImagePh: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourCardTitle: {
    marginTop: 8,
    marginHorizontal: 10,
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  tourCardMeta: {
    marginTop: 4,
    marginHorizontal: 10,
    fontSize: 12,
    color: colors.textSubtle,
    fontWeight: '600',
  },
  outlineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  outlineBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptyTours: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
