import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useGuideModeStore } from '../../entities/guide/guideModeStore';
import { useMyTours } from '../../entities/tour/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  moderation: 'На модерации',
  published: 'Опубликован',
  hidden: 'В архиве',
  rejected: 'Отклонён',
};

export function GuideToursArchiveScreen() {
  const navigation = useNavigation<Nav>();
  const localTours = useGuideModeStore((s) => s.tours);
  const myTours = useMyTours({ page: 1, limit: 100 });

  const archived = useMemo(() => {
    const server = (myTours.data?.data ?? [])
      .filter((tour) => tour.status === 'hidden')
      .map((tour) => ({
        id: tour.id,
        title: tour.title,
        image: tour.cover_image_url ?? tour.images?.[0] ?? null,
        meta: STATUS_LABEL[tour.status] ?? tour.status,
      }));
    const local = localTours
      .filter((tour) => tour.status === 'archived')
      .map((tour) => ({
        id: tour.id,
        title: tour.title,
        image: tour.image,
        meta: 'Локальный архив',
      }));
    return [...server, ...local];
  }, [localTours, myTours.data?.data]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Text style={styles.title}>Архив туров</Text>
      <Text style={styles.subtitle}>Скрытые туры не показываются туристам</Text>

      {myTours.isLoading ? <ActivityIndicator color={colors.textPrimary} /> : null}
      {myTours.isError ? (
        <Text style={styles.errorText}>{extractApiError(myTours.error)}</Text>
      ) : null}

      {archived.length === 0 && !myTours.isLoading ? (
        <Text style={styles.emptyText}>В архиве пока нет туров</Text>
      ) : null}

      {archived.map((tour) => (
        <Pressable
          key={tour.id}
          style={styles.card}
          onPress={() => navigation.navigate('GuideTourManage', { tourId: tour.id })}
        >
          {tour.image ? (
            <Image source={{ uri: tour.image }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imagePh]}>
              <Feather name="image" size={22} color={colors.white} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {tour.title}
            </Text>
            <Text style={styles.cardMeta}>{tour.meta}</Text>
          </View>
        </Pressable>
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
  subtitle: { marginTop: 6, color: colors.textSubtle, fontSize: 14, fontWeight: '600' },
  card: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 10,
  },
  image: { width: 88, height: 72, borderRadius: 8, backgroundColor: colors.line },
  imagePh: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tileSage },
  cardBody: { flex: 1, justifyContent: 'center' },
  cardTitle: { color: colors.textPrimary, fontWeight: '800', fontSize: 16, lineHeight: 20 },
  cardMeta: { marginTop: 4, color: colors.textSubtle, fontSize: 13, fontWeight: '600' },
  emptyText: { marginTop: 16, color: colors.textMuted, fontSize: 14 },
  errorText: { marginTop: 12, color: colors.errorText, fontSize: 13 },
});
