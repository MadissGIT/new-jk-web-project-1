import { Feather, Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '../../entities/auth/authStore';
import type { AuthUser } from '../../entities/auth/authStore';
import { applyForGuide, fetchLatestGuideApplication } from '../../entities/guide/api';
import type { GuidePublicProfile } from '../../entities/guide/api';
import {
  type LocalGuideTour,
  useGuideModeStore,
} from '../../entities/guide/guideModeStore';
import {
  useCancelGuideBooking,
  useConfirmGuideBooking,
  useGuideBookings,
  useGuidePublicProfile,
  useGuideReviews,
  useGuideStats,
  useMyGuideProfile,
  useUpdateMyGuideProfile,
} from '../../entities/guide/hooks';
import {
  buildAccessibilityForApi,
  DEFAULT_ACCESSIBILITY_WHEN_EMPTY,
  hasAccessibilitySelection,
  WIDE_PASSAGES_TAG,
} from '../../entities/tour/accessibility';
import { TourAccessibilitySection } from '../../features/tour/TourAccessibilitySection';
import { TourScheduleSection } from '../../features/tour/TourScheduleSection';
import {
  formatDefaultSlotDate,
  formatSlotDateTime,
  formatTourScheduleLabel,
  parseGuideSlotDateTime,
  toLocalApiDateTime,
} from '../../entities/tour/formatSchedule';
import {
  useCloseTourSlot,
  useCreateTour,
  useCreateTourSlot,
  useMyTours,
  useTour,
  useTourSlots,
  useUpdateTourStatus,
} from '../../entities/tour/hooks';
import type {
  BookingStatus,
  GuideBookingPublic,
  TourDetail,
  TourPublic,
} from '../../entities/tour/types';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { rootNavigationRef } from '../../navigation/navigationRef';
import { extractApiError } from '../../shared/api/http';
import { useUpdateMe } from '../../shared/auth/hooks';
import { geocodeAddress, type GeocodedPoint } from '../../shared/geo/geocodeAddress';
import { colors } from '../../shared/theme/colors';
import { Avatar } from '../../shared/ui/Avatar';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { SaveButton } from '../../shared/ui/SaveButton';

type GuideTabParamList = {
  GuideHome: undefined;
  GuideBookings: undefined;
  GuideTours: undefined;
  GuideProfile: undefined;
};

type Nav = NativeStackNavigationProp<MainStackParamList>;

const Tab = createBottomTabNavigator<GuideTabParamList>();

const SPECIALIZATION_OPTIONS = ['Стрит-арт', 'Архитектура', 'Локальная культура'];
const LANGUAGE_OPTIONS = ['Русский', 'English'];

type GuideTourCardItem = {
  id: string;
  title: string;
  image: string | null;
  scheduleLabel: string;
  ratingLabel: string | null;
  statusLabel?: string;
};

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending_payment: 'Ожидает оплаты',
  confirmed: 'Подтверждено',
  cancelled: 'Отменено',
  completed: 'Завершено',
  refunded: 'Возврат',
};

const TOUR_STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  moderation: 'На модерации',
  published: 'Опубликован',
  hidden: 'Скрыт',
  rejected: 'Отклонён',
};

function guideDisplayName() {
  const user = useAuthStore.getState().user;
  if (!user) return 'Фамилия Имя';
  return [user.surname, user.name].filter(Boolean).join(' ').trim() || user.email;
}

function splitSpecializations(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(/[,;|/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitDisplayNameForSave(fullName: string, user: AuthUser | null) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      surname: parts[0],
      name: parts[1],
      patronymic: parts.slice(2).join(' ') || null,
    };
  }
  if (parts.length === 1) {
    return {
      surname: user?.surname || parts[0],
      name: parts[0],
      patronymic: user?.patronymic ?? null,
    };
  }
  return {
    surname: user?.surname || '',
    name: user?.name || '',
    patronymic: user?.patronymic ?? null,
  };
}

function formatTourRatingLabel(rating: number, reviewsCount: number): string | null {
  if (reviewsCount <= 0) return null;
  return `${rating.toFixed(1).replace('.', ',')} (${reviewsCount})`;
}

function countActiveGuideBookings(bookings: GuideBookingPublic[]): number {
  const now = Date.now();
  return bookings.filter((booking) => {
    if (booking.status !== 'pending_payment' && booking.status !== 'confirmed') {
      return false;
    }
    const startsAt = new Date(booking.slot.starts_at).getTime();
    return !Number.isNaN(startsAt) && startsAt >= now;
  }).length;
}

function pickUpcomingGuideBooking(
  bookings: GuideBookingPublic[],
): GuideBookingPublic | null {
  const now = Date.now();
  return [...bookings]
    .filter((booking) => {
      if (booking.status !== 'pending_payment' && booking.status !== 'confirmed') {
        return false;
      }
      const startsAt = new Date(booking.slot.starts_at).getTime();
      return !Number.isNaN(startsAt) && startsAt >= now;
    })
    .sort(
      (a, b) =>
        new Date(a.slot.starts_at).getTime() - new Date(b.slot.starts_at).getTime(),
    )[0] ?? null;
}

function formatGuideContactLines(guide: GuidePublicProfile): string[] {
  const lines: string[] = [];
  if (guide.email) lines.push(guide.email);
  if (guide.contacts?.trim()) {
    const raw = guide.contacts.trim();
    const looksLikeHandle =
      raw.includes('@') ||
      raw.toLowerCase().includes('t.me') ||
      /^@/.test(raw);
    lines.push(looksLikeHandle ? `TG: ${raw.replace(/^@/, '')}` : raw);
  } else if (guide.phone) {
    lines.push(guide.phone);
  }
  return lines;
}

function serverTourToCard(tour: TourPublic): GuideTourCardItem {
  return {
    id: tour.id,
    title: tour.title,
    image: tour.cover_image_url,
    scheduleLabel:
      formatTourScheduleLabel(tour.duration_minutes, undefined) +
      ` · ${TOUR_STATUS_LABEL[tour.status] ?? tour.status}`,
    ratingLabel: formatTourRatingLabel(tour.rating, tour.reviews_count),
    statusLabel: TOUR_STATUS_LABEL[tour.status],
  };
}

function localTourToCard(tour: LocalGuideTour): GuideTourCardItem {
  const slots = tour.slotStartsAt ? [{ starts_at: tour.slotStartsAt }] : undefined;
  return {
    id: tour.id,
    title: tour.title,
    image: tour.image,
    scheduleLabel: formatTourScheduleLabel(
      tour.durationHours * 60,
      slots,
      tour.scheduleLabel,
    ),
    ratingLabel: null,
    statusLabel: tour.status === 'published' ? 'Локально' : 'Архив',
  };
}

function inferTourTags(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const tags = new Set<string>(['walk']);
  if (/арт|искусств|галере|музе|выстав/.test(text)) tags.add('art');
  if (/истори|стар|архитект/.test(text)) tags.add('history');
  if (/кофе|кафе|гастро|еда|ресторан/.test(text)) tags.add('coffee');
  if (/парк|сад|природ|зел/.test(text)) tags.add('nature');
  if (/музык|концерт|театр|клуб/.test(text)) tags.add('music');
  return [...tags];
}

function patchUserRoleToGuide() {
  const { user, setUser } = useAuthStore.getState();
  if (!user || user.role === 'employee' || user.role === 'admin') return;
  setUser({ ...user, role: 'employee' });
}

export function GuideDashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const status = useGuideModeStore((s) => s.applicationStatus);
  const entered = useGuideModeStore((s) => s.hasEnteredGuideMode);
  const syncApplicationFromServer = useGuideModeStore((s) => s.syncApplicationFromServer);
  const revokeApplication = useGuideModeStore((s) => s.revokeApplication);
  const isGuideRole = user?.role === 'employee' || user?.role === 'admin';
  const latestApplication = useQuery({
    queryKey: ['guide-application', 'me', 'latest'],
    queryFn: fetchLatestGuideApplication,
    enabled: Boolean(token),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  });

  useEffect(() => {
    if (!latestApplication.data) return;
    syncApplicationFromServer(
      latestApplication.data.status,
      latestApplication.data.payload,
      latestApplication.data.rejection_reason,
    );
    if (latestApplication.data.status === 'approved') {
      patchUserRoleToGuide();
    }
  }, [latestApplication.data, syncApplicationFromServer]);

  useEffect(() => {
    if (!isGuideRole && latestApplication.isSuccess && latestApplication.data === null && (status !== 'none' || entered)) {
      revokeApplication();
    }
  }, [entered, isGuideRole, latestApplication.data, latestApplication.isSuccess, revokeApplication, status]);

  if (isGuideRole || status === 'approved' || entered) {
    return <GuideTabs />;
  }

  if (status === 'pending') {
    return <GuideApplicationPendingScreen />;
  }

  if (status === 'rejected') {
    return <GuideApplicationRejectedScreen />;
  }

  return <GuideApplicationFormScreen />;
}

function GuideTabs() {
  return (
    <Tab.Navigator
      initialRouteName="GuideHome"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: colors.textPrimary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          height: 74,
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          paddingBottom: 7,
          paddingTop: 7,
        },
        tabBarActiveBackgroundColor: colors.accentButton,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<keyof GuideTabParamList, keyof typeof Ionicons.glyphMap> = {
            GuideHome: 'home-outline',
            GuideBookings: 'calendar-outline',
            GuideTours: 'ribbon-outline',
            GuideProfile: 'person-outline',
          };
          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="GuideHome" component={GuideHomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="GuideBookings" component={GuideBookingsScreen} options={{ title: 'Брони' }} />
      <Tab.Screen name="GuideTours" component={GuideToursScreen} options={{ title: 'Ваши туры' }} />
      <Tab.Screen name="GuideProfile" component={GuideProfileModeScreen} options={{ title: 'Профиль' }} />
    </Tab.Navigator>
  );
}

function GuideApplicationFormScreen() {
  const submitApplication = useGuideModeStore((s) => s.submitApplication);
  const savedApplication = useGuideModeStore((s) => s.application);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(savedApplication?.displayName ?? guideDisplayName());
  const [bio, setBio] = useState(savedApplication?.bio ?? '');
  const [specializations, setSpecializations] = useState<string[]>(
    savedApplication?.specializations ?? ['Стрит-арт'],
  );
  const [languages, setLanguages] = useState<string[]>(
    savedApplication?.languages ?? ['Русский'],
  );
  const [experience, setExperience] = useState(
    savedApplication?.experienceYears ? String(savedApplication.experienceYears) : '',
  );
  const [contacts, setContacts] = useState(savedApplication?.contacts ?? '');
  const applyMutation = useMutation({
    mutationFn: applyForGuide,
    onSuccess: (application) => {
      submitApplication(application.payload);
      queryClient.setQueryData(['guide-application', 'me', 'latest'], application);
    },
  });

  const canSubmit =
    displayName.trim() &&
    bio.trim().length >= 12 &&
    specializations.length > 0 &&
    languages.length > 0 &&
    Number(experience) >= 0 &&
    contacts.trim().length >= 5;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Text style={styles.bigTitle}>Заполните заявление</Text>
      <UnderlineField label="Отображаемое имя" value={displayName} onChangeText={setDisplayName} />
      <Field
        label="Биография"
        value={bio}
        onChangeText={setBio}
        placeholder="Напишите что-то о себе..."
        multiline
        inputStyle={styles.largeTextarea}
      />
      <PickerBlock
        label="Специализации"
        options={SPECIALIZATION_OPTIONS}
        values={specializations}
        onToggle={(value) =>
          setSpecializations((current) =>
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          )
        }
      />
      <PickerBlock
        label="Языки"
        options={LANGUAGE_OPTIONS}
        values={languages}
        onToggle={(value) =>
          setLanguages((current) =>
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          )
        }
      />
      <UnderlineField
        label="Опыт работы"
        value={experience}
        onChangeText={(value) => setExperience(value.replace(/[^0-9]/g, '').slice(0, 2))}
        placeholder="Введите число"
        suffix="лет"
        keyboardType="number-pad"
      />
      <Field
        label="Публичные контакты"
        value={contacts}
        onChangeText={setContacts}
        placeholder={'Где с Вами можно связаться?\nПрофиль работ / Предыдущее место работы / Отзывы'}
        multiline
        inputStyle={styles.contactsTextarea}
      />
      <SaveButton
        title={applyMutation.isPending ? 'Отправляем...' : 'Отправить заявку'}
        disabled={!canSubmit || applyMutation.isPending}
        style={styles.centerButton}
        onPress={() =>
          applyMutation.mutate({
            displayName: displayName.trim(),
            bio: bio.trim(),
            specializations,
            languages,
            experienceYears: Number(experience) || 0,
            contacts: contacts.trim(),
          })
        }
      />
      {applyMutation.isError ? (
        <Text style={styles.errorText}>{extractApiError(applyMutation.error)}</Text>
      ) : null}
    </ScrollView>
  );
}

export function GuideEditProfileScreen() {
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const updateApplication = useGuideModeStore((s) => s.updateApplication);
  const savedApplication = useGuideModeStore((s) => s.application);
  const myProfile = useMyGuideProfile(Boolean(user));
  const updateMe = useUpdateMe();
  const updateGuideProfile = useUpdateMyGuideProfile();
  const [displayName, setDisplayName] = useState(savedApplication?.displayName ?? guideDisplayName());
  const [bio, setBio] = useState(savedApplication?.bio ?? '');
  const [specializations, setSpecializations] = useState<string[]>(
    savedApplication?.specializations ?? [],
  );
  const [languages, setLanguages] = useState<string[]>(savedApplication?.languages ?? []);
  const [experience, setExperience] = useState(
    savedApplication?.experienceYears ? String(savedApplication.experienceYears) : '',
  );
  const [contacts, setContacts] = useState(savedApplication?.contacts ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hydrateForm = useCallback(() => {
    const fromApp = savedApplication;
    const fromServer = myProfile.data;
    setDisplayName(fromApp?.displayName ?? guideDisplayName());
    setBio(fromServer?.bio || fromApp?.bio || '');
    const specs = fromServer?.specialization
      ? splitSpecializations(fromServer.specialization)
      : (fromApp?.specializations ?? []);
    setSpecializations(specs.length ? specs : []);
    setLanguages(
      fromServer?.languages?.length
        ? fromServer.languages
        : (fromApp?.languages ?? []),
    );
    const years = fromServer?.experience ?? fromApp?.experienceYears;
    setExperience(years != null && years > 0 ? String(years) : '');
    setContacts(fromApp?.contacts ?? '');
    setAvatarUri(user?.avatar_url ?? fromServer?.avatar ?? null);
    setSaveError(null);
  }, [myProfile.data, savedApplication, user?.avatar_url]);

  useFocusEffect(
    useCallback(() => {
      hydrateForm();
    }, [hydrateForm]),
  );

  useEffect(() => {
    if (myProfile.data) hydrateForm();
  }, [myProfile.data, hydrateForm]);

  const pickPhotoOnWeb = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 6 * 1024 * 1024) {
        Alert.alert(
          'Слишком большой файл',
          'Выберите изображение до 6 МБ или сожмите фото перед загрузкой.',
        );
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result;
        if (typeof r === 'string') setAvatarUri(r);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const pickPhoto = async () => {
    if (Platform.OS === 'web') {
      pickPhotoOnWeb();
      return;
    }

    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к фото, чтобы выбрать аватар.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
      });

      if (!result.canceled && result.assets.length > 0) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert(
        'Не удалось открыть галерею',
        'Проверьте, что expo-image-picker установлен и перезапустите Expo.',
      );
    }
  };

  const canSave =
    displayName.trim() &&
    bio.trim().length >= 12 &&
    specializations.length > 0 &&
    languages.length > 0 &&
    Number(experience) >= 0 &&
    contacts.trim().length >= 5;

  const isSaving = updateMe.isPending || updateGuideProfile.isPending;

  const handleSave = async () => {
    if (!user) return;
    setSaveError(null);
    const payload = {
      displayName: displayName.trim(),
      bio: bio.trim(),
      specializations,
      languages,
      experienceYears: Number(experience) || 0,
      contacts: contacts.trim(),
    };

    try {
      await updateMe.mutateAsync({
        ...splitDisplayNameForSave(payload.displayName, user),
        avatar_url: avatarUri || null,
      });
      await updateGuideProfile.mutateAsync({
        bio: payload.bio,
        specialization: payload.specializations.join(', '),
        languages: payload.languages,
        experience: payload.experienceYears,
        avatar: null,
        display_name: payload.displayName,
        contacts: payload.contacts,
      });
      updateApplication(payload);
      navigation.goBack();
    } catch (error) {
      setSaveError(extractApiError(error));
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Text style={styles.bigTitle}>Редактировать профиль</Text>
      <View style={styles.editAvatarRow}>
        <Avatar
          uri={avatarUri}
          name={displayName}
          width={112}
          height={132}
          radius={14}
          shape="rounded"
        />
        <View style={styles.editAvatarActions}>
          <Pressable style={styles.editAvatarBtn} onPress={pickPhoto}>
            <Text style={styles.editAvatarBtnText}>Изменить фото</Text>
          </Pressable>
          {avatarUri ? (
            <Pressable style={styles.editAvatarGhostBtn} onPress={() => setAvatarUri(null)}>
              <Text style={styles.editAvatarGhostBtnText}>Удалить фото</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {myProfile.isLoading ? <ActivityIndicator color={colors.textPrimary} /> : null}
      <UnderlineField label="Отображаемое имя" value={displayName} onChangeText={setDisplayName} />
      <Field
        label="Биография"
        value={bio}
        onChangeText={setBio}
        placeholder="Напишите что-то о себе..."
        multiline
        inputStyle={styles.largeTextarea}
      />
      <PickerBlock
        label="Специализации"
        options={SPECIALIZATION_OPTIONS}
        values={specializations}
        onToggle={(value) =>
          setSpecializations((current) =>
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          )
        }
      />
      <PickerBlock
        label="Языки"
        options={LANGUAGE_OPTIONS}
        values={languages}
        onToggle={(value) =>
          setLanguages((current) =>
            current.includes(value)
              ? current.filter((item) => item !== value)
              : [...current, value],
          )
        }
      />
      <UnderlineField
        label="Опыт работы"
        value={experience}
        onChangeText={(value) => setExperience(value.replace(/[^0-9]/g, '').slice(0, 2))}
        placeholder="Введите число"
        suffix="лет"
        keyboardType="number-pad"
      />
      <Field
        label="Публичные контакты"
        value={contacts}
        onChangeText={setContacts}
        placeholder={'Где с Вами можно связаться?\nПрофиль работ / Предыдущее место работы / Отзывы'}
        multiline
        inputStyle={styles.contactsTextarea}
      />
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
      <SaveButton
        title="Сохранить"
        disabled={!canSave || isSaving}
        style={styles.centerButton}
        onPress={() => void handleSave()}
      />
    </ScrollView>
  );
}

function GuideApplicationPendingScreen() {
  return (
    <View style={styles.root}>
      <ScreenHeader />
      <View style={styles.statusContent}>
        <Text style={styles.statusTitle}>В данный момент заявка находится на рассмотрении</Text>
        <Text style={styles.statusSubtitle}>Пожалуйста, ожидайте</Text>
      </View>
    </View>
  );
}

function GuideApprovedScreen() {
  const enterGuideMode = useGuideModeStore((s) => s.enterGuideMode);
  return (
    <View style={styles.root}>
      <ScreenHeader />
      <View style={styles.statusContent}>
        <Text style={styles.statusTitleLarge}>Поздравляем!{'\n'}Вы стали гидом</Text>
        <Text style={styles.statusSubtitle}>Начните прямо сейчас</Text>
        <View style={styles.bottomActions}>
          <SaveButton
            title="Перейти в профиль гида"
            onPress={() => {
              patchUserRoleToGuide();
              enterGuideMode();
            }}
          />
        </View>
      </View>
    </View>
  );
}

function GuideApplicationRejectedScreen() {
  const reason = useGuideModeStore((s) => s.rejectionReason);
  const revokeApplication = useGuideModeStore((s) => s.revokeApplication);
  return (
    <View style={styles.root}>
      <ScreenHeader />
      <View style={styles.statusContent}>
        <Text style={styles.statusTitleLarge}>Заявка отклонена :(</Text>
        <Text style={styles.rejectReason}>Причина: {reason}</Text>
        <View style={styles.bottomActions}>
          <SaveButton title="Редактировать заявку" onPress={revokeApplication} />
        </View>
      </View>
    </View>
  );
}

function GuideHomeScreen() {
  const navigation = useNavigation<Nav>();
  const application = useGuideModeStore((s) => s.application);
  const myTours = useMyTours({ page: 1, limit: 100 });
  const guideStats = useGuideStats();
  const guideReviews = useGuideReviews();
  const guideBookings = useGuideBookings({ limit: 100 });
  const displayNameParts = application?.displayName.split(' ').filter(Boolean) ?? [];
  const name = displayNameParts[displayNameParts.length - 1] || 'Имя';
  const stats = guideStats.data;
  const bookings = guideBookings.data?.data ?? [];
  const reviewsTotal = guideReviews.data?.meta?.total ?? 0;
  const upcomingBooking = useMemo(() => pickUpcomingGuideBooking(bookings), [bookings]);
  const activeBookingsCount = useMemo(() => countActiveGuideBookings(bookings), [bookings]);

  const ratingText =
    stats && stats.avg_rating > 0
      ? `${stats.avg_rating.toFixed(1).replace('.', ',')} средний рейтинг`
      : 'рейтинг ещё не сформирован';
  const reviewsText =
    reviewsTotal > 0
      ? `${reviewsTotal} ${reviewsTotal === 1 ? 'отзыв' : reviewsTotal < 5 ? 'отзыва' : 'отзывов'}`
      : 'отзывов пока нет';
  const toursText =
    stats && stats.tours_count > 0
      ? `${stats.tours_count} ${stats.tours_count === 1 ? 'тур' : stats.tours_count < 5 ? 'тура' : 'туров'}`
      : 'туров пока нет';
  const clientsText =
    stats && stats.bookings_count > 0
      ? `${stats.bookings_count} броней всего`
      : 'броней пока нет';

  const statsLoading = guideStats.isLoading || guideBookings.isLoading;
  const statsError = guideStats.isError ? extractApiError(guideStats.error) : null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.guideContent}>
      <Text style={styles.heroTitle}>Добрый день,{'\n'}{name}!</Text>
      <View style={styles.statBlock}>
        <Feather name="bar-chart-2" size={30} color={colors.textPrimary} />
        <Text style={styles.guideHomeSectionTitle}>Статистика</Text>
      </View>
      {statsLoading ? <ActivityIndicator color={colors.textPrimary} style={styles.statsLoader} /> : null}
      {statsError ? <Text style={styles.errorText}>{statsError}</Text> : null}
      {!statsLoading ? (
        <>
          <InfoRow icon="star" text={ratingText} compact />
          <InfoRow icon="message-square" text={reviewsText} compact />
          <InfoRow icon="map" text={toursText} compact />
          <InfoRow icon="users" text={clientsText} compact />
          <InfoRow
            icon="calendar"
            text={
              activeBookingsCount > 0
                ? `${activeBookingsCount} активных заявок`
                : 'активных заявок нет'
            }
            compact
          />
        </>
      ) : null}

      <View style={styles.statBlock}>
        <Feather name="clock" size={30} color={colors.textPrimary} />
        <Text style={styles.guideHomeSectionTitle}>Ближайшие туры</Text>
      </View>
      {guideBookings.isLoading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : upcomingBooking ? (
        <>
          <Text style={styles.nearestTextCompact}>
            {formatSlotDateTime(upcomingBooking.slot.starts_at)}
          </Text>
          <Text style={styles.nearestTextCompact}>{upcomingBooking.tour.title}</Text>
          <Pressable
            style={styles.outlineBtn}
            onPress={() =>
              navigation.navigate('GuideBookingsDetail', { tourId: upcomingBooking.tour.id })
            }
          >
            <Text style={styles.outlineBtnText}>Перейти к заявкам</Text>
          </Pressable>
        </>
      ) : stats?.top_tours[0] ? (
        <>
          <Text style={styles.nearestTextCompact}>Популярный тур:</Text>
          <Text style={styles.nearestTextCompact}>{stats.top_tours[0].title}</Text>
          <Text style={styles.mutedText}>
            {stats.top_tours[0].bookings_count} броней · рейтинг{' '}
            {stats.top_tours[0].rating.toFixed(1).replace('.', ',')}
          </Text>
          <Pressable
            style={styles.outlineBtn}
            onPress={() =>
              navigation.navigate('GuideBookingsDetail', { tourId: stats.top_tours[0].id })
            }
          >
            <Text style={styles.outlineBtnText}>Перейти</Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.emptyText}>Ближайших выходов пока нет</Text>
      )}
      <SaveButton
        title="+ Создать тур"
        style={styles.createButton}
        onPress={() => navigation.navigate('GuideCreateTour')}
      />
    </ScrollView>
  );
}

function GuideBookingsScreen() {
  const navigation = useNavigation<Nav>();
  const myTours = useMyTours({ page: 1, limit: 100 });
  const guideBookings = useGuideBookings();

  const toursWithBookings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const booking of guideBookings.data?.data ?? []) {
      counts.set(booking.tour.id, (counts.get(booking.tour.id) ?? 0) + 1);
    }
    return (myTours.data?.data ?? [])
      .filter((tour) => counts.has(tour.id))
      .map((tour) => ({
        card: serverTourToCard(tour),
        bookingsCount: counts.get(tour.id) ?? 0,
      }));
  }, [guideBookings.data?.data, myTours.data?.data]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.guideContent}>
      <Text style={styles.pageTitle}>Бронирования</Text>
      {guideBookings.isLoading ? <ActivityIndicator color={colors.textPrimary} /> : null}
      <View style={styles.tourGrid}>
        {toursWithBookings.map(({ card, bookingsCount }) => (
          <GuideTourMiniCard
            key={card.id}
            tour={{
              ...card,
              scheduleLabel: `${bookingsCount} заявок`,
            }}
            onPress={() => navigation.navigate('GuideBookingsDetail', { tourId: card.id })}
          />
        ))}
      </View>
      {!guideBookings.isLoading && toursWithBookings.length === 0 ? (
        <Text style={styles.emptyText}>Бронирований пока нет</Text>
      ) : null}
      {guideBookings.isError ? (
        <Text style={styles.errorText}>{extractApiError(guideBookings.error)}</Text>
      ) : null}
    </ScrollView>
  );
}

export function GuideBookingsDetailScreen({
  route,
}: {
  route: { params: { tourId: string } };
}) {
  const { tourId } = route.params;
  const tour = useTour(tourId);
  const bookings = useGuideBookings({ tour_id: tourId });
  const confirmBooking = useConfirmGuideBooking();
  const cancelBooking = useCancelGuideBooking();
  const [actionError, setActionError] = useState<string | null>(null);

  const items = bookings.data?.data ?? [];
  const slotLabel = items[0]
    ? formatSlotDateTime(items[0].slot.starts_at)
    : '—';
  const participantsTotal = items.reduce((sum, item) => sum + item.participants_count, 0);
  const capacity = tour.data?.group_size_max ?? '—';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.guideContent}>
      <ScreenHeader />
      {tour.isLoading ? <ActivityIndicator color={colors.textPrimary} /> : null}
      <Text style={styles.statusTitleLarge}>{tour.data?.title ?? 'Тур'}</Text>
      <InfoRow icon="users" text={`${participantsTotal} / ${capacity} участников`} />
      <InfoRow icon="clock" text={slotLabel} />
      <InfoRow
        icon="map"
        text={tour.data?.meeting_point.address ?? 'Место встречи уточняется'}
      />
      <Text style={styles.sectionTitle}>Заявки ({items.length})</Text>
      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
      {items.map((booking) => (
        <GuideBookingCard
          key={booking.id}
          booking={booking}
          isBusy={confirmBooking.isPending || cancelBooking.isPending}
          onConfirm={async () => {
            setActionError(null);
            try {
              await confirmBooking.mutateAsync(booking.id);
            } catch (error) {
              setActionError(extractApiError(error));
            }
          }}
          onCancel={async () => {
            setActionError(null);
            try {
              await cancelBooking.mutateAsync(booking.id);
            } catch (error) {
              setActionError(extractApiError(error));
            }
          }}
        />
      ))}
      {!bookings.isLoading && items.length === 0 ? (
        <Text style={styles.mutedText}>Заявок по этому туру пока нет</Text>
      ) : null}
    </ScrollView>
  );
}

function GuideToursScreen() {
  const navigation = useNavigation<Nav>();
  const tours = useGuideModeStore((s) => s.tours);
  const myTours = useMyTours({ page: 1, limit: 100 });
  const tourCards = useMemo(() => {
    const server = (myTours.data?.data ?? [])
      .filter((tour) => tour.status !== 'hidden')
      .map(serverTourToCard);
    const local = tours
      .filter((tour) => tour.status !== 'archived')
      .map(localTourToCard);
    return [...server, ...local];
  }, [myTours.data?.data, tours]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.guideContent}>
      <Text style={styles.pageTitle}>Ваши туры</Text>
      <SaveButton
        title="+ Создать тур"
        style={styles.alignStartButton}
        onPress={() => navigation.navigate('GuideCreateTour')}
      />
      {myTours.isLoading ? <ActivityIndicator color={colors.textPrimary} /> : null}
      <View style={styles.tourGrid}>
        {tourCards.map((tour) => (
          <GuideTourMiniCard
            key={tour.id}
            tour={tour}
            onPress={() => navigation.navigate('GuideTourManage', { tourId: tour.id })}
          />
        ))}
      </View>
      {tourCards.length === 0 && !myTours.isLoading ? <Text style={styles.emptyText}>Вы пока не создали ни одного тура</Text> : null}
      {myTours.isError ? <Text style={styles.errorText}>{extractApiError(myTours.error)}</Text> : null}
    </ScrollView>
  );
}

function GuideProfileModeScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const navigation = useNavigation<Nav>();
  const exitGuideMode = useGuideModeStore((s) => s.exitGuideMode);
  const profile = useGuidePublicProfile(userId);
  const handleExitGuideMode = () => {
    exitGuideMode();
    if (rootNavigationRef.isReady()) {
      rootNavigationRef.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  if (profile.isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.errorText}>{extractApiError(profile.error)}</Text>
      </View>
    );
  }

  const guide = profile.data;
  const specializations = splitSpecializations(guide.specialization);
  const contactLines = formatGuideContactLines(guide);
  const languageLines =
    guide.languages.length > 0 ? [guide.languages.join(' / ')] : [];
  const experienceLines = [
    guide.experience > 0 ? `${guide.experience} лет в сфере` : null,
    guide.tours_count > 0 ? `${guide.tours_count}+ туров` : null,
  ].filter((line): line is string => Boolean(line));
  const ratingLabel =
    guide.reviews_count > 0
      ? `☆ ${guide.rating.toFixed(1)} (${guide.reviews_count} отзывов)`
      : '☆ пока нет отзывов';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.guideContent}>
      <Text style={styles.profileTitle}>Профиль гида</Text>
      <View style={styles.profileRow}>
        {guide.avatar ? (
          <Image source={{ uri: guide.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Feather name="user" size={44} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.profileMeta}>
          <Text style={styles.profileName}>{guide.name}</Text>
          {contactLines.map((line) => (
            <Text key={line} style={styles.mutedText}>
              {line}
            </Text>
          ))}
          <Pressable
            onPress={() => navigation.navigate('GuideReviews')}
            accessibilityRole="button"
          >
            <Text style={styles.reviewLink}>{ratingLabel}</Text>
          </Pressable>
          <Pressable style={styles.smallGreenBtn} onPress={() => navigation.navigate('GuideEditProfile')}>
            <Text style={styles.smallGreenBtnText}>Редактировать</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.bioText}>
        {guide.bio.trim() ||
          'Добавьте биографию в разделе «Редактировать» — туристы увидят её в вашем профиле.'}
      </Text>
      <InfoSection icon="award" title="Специализации" lines={specializations} />
      <InfoSection icon="globe" title="Языки" lines={languageLines} />
      <InfoSection icon="users" title="Опыт" lines={experienceLines} />
      <View style={styles.tilesRow}>
        <GuideTile
          icon="message-square"
          label="Отзывы"
          onPress={() => navigation.navigate('GuideReviews')}
        />
        <GuideTile
          icon="briefcase"
          label="Архив туров"
          onPress={() => navigation.navigate('GuideToursArchive')}
        />
      </View>
      <View style={styles.tilesRow}>
        <GuideTile icon="edit-3" label="Вывод ДС" />
      </View>
      <Pressable style={styles.logoutGuideBtn} onPress={handleExitGuideMode}>
        <Text style={styles.logoutGuideText}>Выйти из режима гида</Text>
        <Feather name="log-out" size={18} color={colors.textPrimary} />
      </Pressable>
    </ScrollView>
  );
}

export function GuideCreateTourScreen() {
  const navigation = useNavigation<Nav>();
  const addTour = useGuideModeStore((s) => s.addTour);
  const createTour = useCreateTour();
  const createSlot = useCreateTourSlot();
  const queryClient = useQueryClient();
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<LocalGuideTour['paymentMode']>('before_start');
  const [deadline, setDeadline] = useState('');
  const [groupType, setGroupType] = useState<LocalGuideTour['groupType']>('group');
  const [maxPeople, setMaxPeople] = useState('');
  const [duration, setDuration] = useState('');
  const [slotDate, setSlotDate] = useState(formatDefaultSlotDate);
  const [slotTime, setSlotTime] = useState('18:00');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [meetingResolved, setMeetingResolved] = useState<GeocodedPoint | null>(null);
  const [meetingGeocodeError, setMeetingGeocodeError] = useState<string | null>(null);
  const [isGeocodingMeeting, setIsGeocodingMeeting] = useState(false);
  const [accessibility, setAccessibility] = useState({
    ramp: false,
    widePassages: false,
    stairs: false,
  });

  const canSave =
    title.trim() &&
    price.trim() &&
    description.trim() &&
    coverImageUri &&
    (groupType === 'individual' || maxPeople.trim()) &&
    duration.trim() &&
    slotDate.trim() &&
    slotTime.trim() &&
    meetingPoint.trim();
  const isSaving = createTour.isPending || createSlot.isPending || isGeocodingMeeting;

  const resolveMeetingPoint = async (addressText: string): Promise<GeocodedPoint> => {
    if (meetingResolved && meetingPoint.trim() === addressText) {
      return meetingResolved;
    }
    return geocodeAddress(addressText);
  };

  const previewMeetingOnMap = async () => {
    const addressText = meetingPoint.trim();
    if (!addressText) {
      setMeetingGeocodeError('Укажите адрес места встречи');
      return;
    }
    setIsGeocodingMeeting(true);
    setMeetingGeocodeError(null);
    try {
      const resolved = await geocodeAddress(addressText);
      setMeetingResolved(resolved);
      if (resolved.address) {
        setMeetingPoint(resolved.address);
      }
    } catch (error) {
      setMeetingResolved(null);
      setMeetingGeocodeError(
        error instanceof Error ? error.message : 'Не удалось найти адрес на карте',
      );
    } finally {
      setIsGeocodingMeeting(false);
    }
  };

  const pickCoverOnWeb = () => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1.5 * 1024 * 1024) {
        Alert.alert('Слишком большой файл', 'Выберите изображение до 1,5 МБ для отправки на модерацию.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') setCoverImageUri(result);
      };
      reader.onerror = () => {
        Alert.alert('Не удалось прочитать файл', 'Попробуйте выбрать другое изображение.');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const pickCover = async () => {
    if (Platform.OS === 'web') {
      pickCoverOnWeb();
      return;
    }

    try {
      const ImagePicker = await import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Нет доступа', 'Разрешите доступ к фото, чтобы прикрепить обложку тура.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.75,
        base64: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 1.5 * 1024 * 1024) {
          Alert.alert('Слишком большой файл', 'Выберите изображение до 1,5 МБ или сожмите фото.');
          return;
        }
        if (asset.base64) {
          setCoverImageUri(`data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`);
        } else {
          setCoverImageUri(asset.uri);
        }
      }
    } catch {
      Alert.alert(
        'Не удалось открыть галерею',
        'Проверьте, что expo-image-picker установлен и перезапустите Expo.',
      );
    }
  };

  const save = async (mode: 'moderation' | 'archive') => {
    const durationHours = Number(duration) || 1;
    const priceAmount = Number(price) || 0;
    const people = groupType === 'individual' ? 1 : Number(maxPeople) || 1;
    const titleText = title.trim();
    const descriptionText = description.trim();
    const meetingText = meetingPoint.trim() || 'Место встречи уточняется';
    const coverImage = coverImageUri ?? '';

    let parsedSlot: ReturnType<typeof parseGuideSlotDateTime>;
    try {
      parsedSlot = parseGuideSlotDateTime(slotDate, slotTime, durationHours);
    } catch (error) {
      setInlineError(error instanceof Error ? error.message : 'Укажите дату и время тура');
      return;
    }
    const slotStartsAt = toLocalApiDateTime(parsedSlot.starts);
    const slotEndsAt = toLocalApiDateTime(parsedSlot.ends);
    const scheduleLabel = formatTourScheduleLabel(durationHours * 60, [
      { starts_at: slotStartsAt },
    ]);

    if (mode === 'archive') {
      const tour = addTour({
        title: titleText,
        description: descriptionText,
        price: priceAmount,
        paymentMode,
        paymentDeadlineHours: Number(deadline) || 0,
        groupType,
        maxPeople: people,
        durationHours,
        meetingPoint: meetingText,
        accessibility,
        image: coverImage,
        scheduleLabel,
        slotStartsAt,
      });
      navigation.replace('GuideTourManage', { tourId: tour.id });
      return;
    }

    try {
      setInlineError(null);
      setIsGeocodingMeeting(true);
      const resolvedMeetingPoint = await resolveMeetingPoint(meetingText);
      setIsGeocodingMeeting(false);
      const baseTags = inferTourTags(titleText, descriptionText);
      const accessibilityPayload = buildAccessibilityForApi(accessibility, baseTags);
      const tour = await createTour.mutateAsync({
        title: titleText,
        description: descriptionText,
        city_id: 'ekb',
        format: groupType === 'individual' ? 'private_tour' : 'offline_guided',
        language: 'ru',
        duration_minutes: durationHours * 60,
        group_size_max: people,
        price_amount: priceAmount,
        price_currency: 'RUB',
        tags: accessibilityPayload.tags,
        meeting_lat: resolvedMeetingPoint.lat,
        meeting_lng: resolvedMeetingPoint.lng,
        meeting_address: resolvedMeetingPoint.address || meetingText,
        wheelchair_accessible: accessibilityPayload.wheelchair_accessible,
        avoid_stairs_possible: accessibilityPayload.avoid_stairs_possible,
        cover_image_url: null,
        images: [coverImage],
        cancellation_policy: paymentMode,
        route_distance_meters: 0,
        route_points_count: 0,
      });
      await createSlot.mutateAsync({
        tourId: tour.id,
        payload: {
          starts_at: slotStartsAt,
          ends_at: slotEndsAt,
          available_capacity: people,
          price: { amount: priceAmount, currency: 'RUB' },
          status: 'available',
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['tours', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['tours', 'list'] });
      await queryClient.invalidateQueries({ queryKey: ['tours', 'slots', tour.id] });
      navigation.replace('GuideTourManage', { tourId: tour.id });
    } catch (error) {
      setIsGeocodingMeeting(false);
      setInlineError(extractApiError(error));
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Pressable style={styles.imagePicker} onPress={pickCover}>
        {coverImageUri ? (
          <Image source={{ uri: coverImageUri }} style={styles.imagePickerPreview} resizeMode="cover" />
        ) : (
          <>
            <Feather name="image" size={42} color={colors.white} />
            <Text style={styles.imagePickerText}>Добавить фото тура</Text>
          </>
        )}
      </Pressable>
      <Text style={styles.imagePickerHint}>
        Рекомендуемый формат: 16:9, 1280×720 или 1920×1080, до 1,5 МБ
      </Text>
      <UnderlineField label="Название" value={title} onChangeText={setTitle} />
      <UnderlineField
        label="Цена"
        value={price}
        onChangeText={(value) => setPrice(value.replace(/[^0-9]/g, '').slice(0, 7))}
        suffix="руб."
        keyboardType="number-pad"
      />
      <Field
        label="Описание"
        value={description}
        onChangeText={setDescription}
        placeholder="Расскажите о туре..."
        multiline
        inputStyle={styles.tourTextarea}
      />
      <ChoiceGroup
        title="Оплата"
        value={paymentMode}
        onChange={setPaymentMode}
        items={[
          ['now', 'Сразу'],
          ['before_start', 'Не менее, чем за несколько часов до начала тура'],
          ['on_meeting', 'При встрече'],
        ]}
      />
      <UnderlineField
        label="За сколько нужно внести оплату"
        value={deadline}
        onChangeText={(value) => setDeadline(value.replace(/[^0-9]/g, '').slice(0, 3))}
        placeholder="Введите число"
        suffix="час."
        keyboardType="number-pad"
      />
      <ChoiceGroup
        title="Количество человек"
        value={groupType}
        onChange={setGroupType}
        items={[
          ['group', 'Группы'],
          ['individual', 'Индивидуально'],
        ]}
      />
      {groupType === 'group' ? (
        <UnderlineField
          label="Сколько человек может быть в группе"
          value={maxPeople}
          onChangeText={(value) => setMaxPeople(value.replace(/[^0-9]/g, '').slice(0, 3))}
          placeholder="Введите число"
          suffix="чел."
          keyboardType="number-pad"
        />
      ) : null}
      <Text style={styles.sectionTitle}>Расписание</Text>
      <Text style={styles.sectionHint}>
        Укажите длительность и первый выход — туристы увидят дату на странице тура. Дополнительные
        слоты можно добавить после публикации.
      </Text>
      <UnderlineField
        label="Продолжительность тура"
        value={duration}
        onChangeText={(value) => setDuration(value.replace(/[^0-9]/g, '').slice(0, 2))}
        placeholder="1–12"
        suffix="час."
        keyboardType="number-pad"
      />
      <UnderlineField
        label="Дата тура"
        value={slotDate}
        onChangeText={setSlotDate}
        placeholder="ДД.ММ.ГГГГ"
      />
      <UnderlineField
        label="Время начала"
        value={slotTime}
        onChangeText={(value) => setSlotTime(value.replace(/[^0-9:]/g, '').slice(0, 5))}
        placeholder="18:00"
      />
      <UnderlineField
        label="Точка начала маршрута"
        value={meetingPoint}
        onChangeText={(value) => {
          setMeetingPoint(value);
          setMeetingResolved(null);
          setMeetingGeocodeError(null);
        }}
        placeholder="ул. Попова, 13, Екатеринбург"
      />
      <Pressable
        style={styles.outlineBtn}
        onPress={() => void previewMeetingOnMap()}
        disabled={isGeocodingMeeting || !meetingPoint.trim()}
      >
        <Text style={styles.outlineBtnText}>
          {isGeocodingMeeting ? 'Ищем на карте…' : 'Проверить на карте'}
        </Text>
      </Pressable>
      {meetingResolved ? (
        <Text style={styles.meetingResolved}>
          Точка на карте: {meetingResolved.address || meetingPoint.trim()}
        </Text>
      ) : null}
      {meetingGeocodeError ? (
        <Text style={styles.errorText}>{meetingGeocodeError}</Text>
      ) : null}
      <Text style={styles.sectionTitle}>Доступность</Text>
      <Text style={styles.sectionHint}>
        Необязательно. Если ничего не отметить, туристы увидят, что особенности маршрута не указаны.
      </Text>
      <CheckRow
        label="пандус"
        checked={accessibility.ramp}
        onPress={() => setAccessibility((value) => ({ ...value, ramp: !value.ramp }))}
      />
      <CheckRow
        label="широкие проходы"
        checked={accessibility.widePassages}
        onPress={() => setAccessibility((value) => ({ ...value, widePassages: !value.widePassages }))}
      />
      <CheckRow
        label="ступени"
        checked={accessibility.stairs}
        onPress={() => setAccessibility((value) => ({ ...value, stairs: !value.stairs }))}
      />
      {inlineError ? <Text style={styles.errorText}>{inlineError}</Text> : null}
      <SaveButton
        title={isSaving ? 'Отправляем...' : 'Отправить на модерацию'}
        disabled={!canSave || isSaving}
        style={styles.centerButton}
        onPress={() => save('moderation')}
      />
      <SaveButton
        title="Сохранить черновик"
        disabled={!canSave || isSaving}
        style={styles.centerButtonSmall}
        onPress={() => save('archive')}
      />
    </ScrollView>
  );
}

export function GuideTourManageScreen({
  route,
}: {
  route: { params: { tourId: string } };
}) {
  const navigation = useNavigation<Nav>();
  const localTour = useGuideModeStore((s) => s.tours.find((item) => item.id === route.params.tourId));
  const archiveLocalTour = useGuideModeStore((s) => s.archiveTour);
  const serverTour = useTour(localTour ? null : route.params.tourId);
  const tourSlots = useTourSlots(localTour ? null : route.params.tourId);
  const updateTourStatus = useUpdateTourStatus();
  const tour = serverTour.data;
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleArchive = async () => {
    if (localTour) {
      archiveLocalTour(localTour.id);
      navigation.goBack();
      return;
    }
    if (!tour || tour.status === 'hidden') return;
    setArchiveError(null);
    try {
      await updateTourStatus.mutateAsync({ tourId: tour.id, status: 'hidden' });
      navigation.goBack();
    } catch (error) {
      setArchiveError(extractApiError(error));
    }
  };

  if (!localTour && serverTour.isLoading) {
    return (
      <View style={styles.root}>
        <ScreenHeader />
        <ActivityIndicator color={colors.textPrimary} />
      </View>
    );
  }

  if (!localTour && !tour) {
    return (
      <View style={styles.root}>
        <ScreenHeader />
        <Text style={styles.pageTitle}>Тур не найден</Text>
        {serverTour.isError ? <Text style={styles.errorText}>{extractApiError(serverTour.error)}</Text> : null}
      </View>
    );
  }

  const isArchived = tour?.status === 'hidden' || localTour?.status === 'archived';
  const isArchiving = updateTourStatus.isPending;

  if (tour) {
    const image = tour.images[0];
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ScreenHeader />
        {image ? (
          <Image source={{ uri: image }} style={styles.detailImage} resizeMode="cover" />
        ) : (
          <View style={[styles.detailImage, styles.imagePlaceholder]}>
            <Feather name="image" size={34} color={colors.white} />
          </View>
        )}
        <Text style={styles.manageTitle}>{tour.title}</Text>
        <Text style={styles.manageDescription}>{tour.description}</Text>
        <InfoRow
          icon="users"
          text={tour.format === 'private_tour' ? 'Индивидуально' : `Группы до ${tour.group_size_max} человек`}
        />
        <InfoRow
          icon="info"
          text={TOUR_STATUS_LABEL[tour.status] ?? tour.status}
        />
        <InfoRow icon="map" text={tour.meeting_point.address ?? 'Место встречи уточняется'} />
        <Text style={styles.sectionTitle}>Расписание и доступность</Text>
        <TourScheduleSection
          durationMinutes={tour.duration_minutes}
          slots={tourSlots.data}
          isLoading={tourSlots.isLoading}
          title=""
        />
        <GuideTourSlotsPanel tour={tour} slots={tourSlots.data ?? []} />
        <TourAccessibilitySection
          accessibility={tour.accessibility}
          tags={tour.tags}
          title=""
        />
        {tour.status === 'moderation' ? (
          <Text style={styles.mutedText}>Тур отправлен на проверку. После одобрения он появится у туристов.</Text>
        ) : null}
        {isArchived ? (
          <Text style={styles.mutedText}>Тур в архиве и скрыт от туристов.</Text>
        ) : (
          <>
            {archiveError ? <Text style={styles.errorText}>{archiveError}</Text> : null}
            <SaveButton
              title={isArchiving ? 'Сохраняем...' : 'Убрать в архив'}
              disabled={isArchiving}
              style={styles.centerButtonSmall}
              onPress={() => void handleArchive()}
            />
          </>
        )}
      </ScrollView>
    );
  }

  const tourLocal = localTour as LocalGuideTour;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Image source={{ uri: tourLocal.image }} style={styles.detailImage} resizeMode="cover" />
      <Text style={styles.manageTitle}>{tourLocal.title}</Text>
      <Text style={styles.manageDescription}>{tourLocal.description}</Text>
      <InfoRow
        icon="users"
        text={tourLocal.groupType === 'group' ? `Группы до ${tourLocal.maxPeople} человек` : 'Индивидуально'}
      />
      <InfoRow icon="map" text={tourLocal.meetingPoint} />
      <Text style={styles.sectionTitle}>Расписание и доступность</Text>
      <TourScheduleSection
        durationMinutes={tourLocal.durationHours * 60}
        slots={tourLocal.slotStartsAt ? [{ starts_at: tourLocal.slotStartsAt }] : undefined}
        fallbackSchedule={tourLocal.scheduleLabel}
        title=""
      />
      <TourAccessibilitySection
        accessibility={
          hasAccessibilitySelection(tourLocal.accessibility)
            ? {
                wheelchair_accessible: tourLocal.accessibility.ramp,
                avoid_stairs_possible: !tourLocal.accessibility.stairs,
              }
            : { ...DEFAULT_ACCESSIBILITY_WHEN_EMPTY }
        }
        tags={tourLocal.accessibility.widePassages ? [WIDE_PASSAGES_TAG] : []}
        title=""
      />
      {isArchived ? (
        <Text style={styles.mutedText}>Тур в архиве.</Text>
      ) : (
        <SaveButton
          title="Убрать в архив"
          style={styles.centerButtonSmall}
          onPress={() => void handleArchive()}
        />
      )}
    </ScrollView>
  );
}

function GuideTourMiniCard({ tour, onPress }: { tour: GuideTourCardItem; onPress: () => void }) {
  return (
    <Pressable style={styles.miniCard} onPress={onPress}>
      {tour.image ? (
        <Image source={{ uri: tour.image }} style={styles.miniImage} resizeMode="cover" />
      ) : (
        <View style={[styles.miniImage, styles.imagePlaceholder]}>
          <Feather name="image" size={22} color={colors.white} />
        </View>
      )}
      {tour.ratingLabel ? (
        <View style={styles.ratingPill}>
          <Text style={styles.ratingText}>{tour.ratingLabel}</Text>
        </View>
      ) : null}
      <Text style={styles.miniTitle} numberOfLines={2}>{tour.title}</Text>
      <Text style={styles.miniMeta}>{tour.scheduleLabel}</Text>
      <Pressable style={styles.detailsBtn} onPress={onPress}>
        <Text style={styles.detailsBtnText}>Детали</Text>
      </Pressable>
    </Pressable>
  );
}

function GuideBookingCard({
  booking,
  isBusy,
  onConfirm,
  onCancel,
}: {
  booking: GuideBookingPublic;
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const canConfirm = booking.status === 'pending_payment';
  const canCancel = booking.status === 'pending_payment' || booking.status === 'confirmed';

  return (
    <View style={styles.bookingPerson}>
      <Text style={styles.bookingName}>{booking.customer_name}</Text>
      <Text style={styles.bookingText}>
        Слот: {formatSlotDateTime(booking.slot.starts_at)}
      </Text>
      <Text style={styles.bookingText}>
        Статус: {BOOKING_STATUS_LABEL[booking.status] ?? booking.status}
      </Text>
      <Text style={styles.bookingText}>
        Участников: {booking.participants_count} ·{' '}
        {booking.price_total.amount.toLocaleString('ru-RU')} {booking.price_total.currency}
      </Text>
      <Text style={styles.bookingText}>
        Контакт: {booking.contact_phone?.trim() || 'не указан'}
      </Text>
      {booking.comment?.trim() ? (
        <Text style={styles.bookingText}>Комментарий: {booking.comment.trim()}</Text>
      ) : null}
      <View style={styles.stubRow}>
        {canCancel ? (
          <Pressable style={styles.outlineBtn} disabled={isBusy} onPress={onCancel}>
            <Text style={styles.outlineBtnText}>Отменить</Text>
          </Pressable>
        ) : null}
        {canConfirm ? (
          <Pressable style={styles.outlineBtn} disabled={isBusy} onPress={onConfirm}>
            <Text style={styles.outlineBtnText}>Подтвердить</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function GuideTourSlotsPanel({
  tour,
  slots,
}: {
  tour: Pick<TourDetail, 'id' | 'duration_minutes' | 'group_size_max' | 'price'>;
  slots: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    available_capacity: number;
    status: string;
    price: { amount: number; currency: string };
  }>;
}) {
  const createSlot = useCreateTourSlot();
  const closeSlot = useCloseTourSlot();
  const [slotDate, setSlotDate] = useState(formatDefaultSlotDate());
  const [slotTime, setSlotTime] = useState('18:00');
  const [slotError, setSlotError] = useState<string | null>(null);

  const addSlot = async () => {
    try {
      setSlotError(null);
      const durationHours = Math.max(1, Math.round(tour.duration_minutes / 60));
      const parsed = parseGuideSlotDateTime(slotDate, slotTime, durationHours);
      await createSlot.mutateAsync({
        tourId: tour.id,
        payload: {
          starts_at: toLocalApiDateTime(parsed.starts),
          ends_at: toLocalApiDateTime(parsed.ends),
          available_capacity: tour.group_size_max,
          price: { amount: tour.price.amount, currency: tour.price.currency },
          status: 'available',
        },
      });
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : extractApiError(error));
    }
  };

  return (
    <View style={styles.slotsBlock}>
      <Text style={styles.sectionTitle}>Выходы (слоты)</Text>
      {slots.length === 0 ? (
        <Text style={styles.mutedText}>Слотов пока нет — добавьте дату выхода.</Text>
      ) : (
        slots.map((slot) => (
          <View key={slot.id} style={styles.slotRow}>
            <Text style={styles.slotRowTitle}>{formatSlotDateTime(slot.starts_at)}</Text>
            <Text style={styles.mutedText}>
              Мест: {slot.available_capacity} ·{' '}
              {slot.status === 'available'
                ? 'Доступен'
                : slot.status === 'cancelled'
                  ? 'Закрыт'
                  : 'Нет мест'}
            </Text>
            {slot.status === 'available' ? (
              <Pressable
                style={styles.outlineBtn}
                disabled={closeSlot.isPending}
                onPress={() => void closeSlot.mutateAsync({ tourId: tour.id, slotId: slot.id })}
              >
                <Text style={styles.outlineBtnText}>Закрыть слот</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
      <UnderlineField label="Дата выхода" value={slotDate} onChangeText={setSlotDate} placeholder="ДД.ММ.ГГГГ" />
      <UnderlineField
        label="Время начала"
        value={slotTime}
        onChangeText={(value) => setSlotTime(value.replace(/[^0-9:]/g, '').slice(0, 5))}
        placeholder="18:00"
      />
      {slotError ? <Text style={styles.errorText}>{slotError}</Text> : null}
      <SaveButton
        title={createSlot.isPending ? 'Добавляем...' : 'Добавить слот'}
        disabled={createSlot.isPending}
        style={styles.centerButtonSmall}
        onPress={() => void addSlot()}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  inputStyle,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  inputStyle?: object;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabelStrong}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, inputStyle]}
      />
    </View>
  );
}

function UnderlineField({
  label,
  value,
  onChangeText,
  placeholder,
  suffix,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  keyboardType?: 'default' | 'number-pad';
}) {
  return (
    <View style={styles.underlineWrap}>
      <Text style={styles.fieldLabelStrong}>{label}</Text>
      <View style={styles.underlineRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          keyboardType={keyboardType}
          style={styles.underlineInput}
        />
        {suffix ? <Text style={styles.suffixText}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function PickerBlock({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: string[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={styles.underlineWrap}>
      <Text style={styles.fieldLabelStrong}>{label}</Text>
      <View style={styles.chipsWrap}>
        {options.map((option) => (
          <Pressable
            key={option}
            style={[styles.chip, values.includes(option) && styles.chipActive]}
            onPress={() => onToggle(option)}
          >
            <Text style={[styles.chipText, values.includes(option) && styles.chipTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ChoiceGroup<T extends string>({
  title,
  value,
  onChange,
  items,
}: {
  title: string;
  value: T;
  onChange: (value: T) => void;
  items: Array<[T, string]>;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.fieldLabelStrong}>{title}</Text>
      {items.map(([id, label]) => (
        <CheckRow key={id} label={label} checked={value === id} onPress={() => onChange(id)} />
      ))}
    </View>
  );
}

function CheckRow({ label, checked, onPress }: { label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.checkRow} onPress={onPress}>
      <Feather name={checked ? 'check-circle' : 'circle'} size={18} color={colors.textPrimary} />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({
  icon,
  text,
  compact,
}: {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.infoRow, compact && styles.infoRowCompact]}>
      <Feather name={icon} size={compact ? 22 : 24} color={colors.textPrimary} />
      <Text style={[styles.infoText, compact && styles.infoTextCompact]}>{text}</Text>
    </View>
  );
}

function InfoSection({ icon, title, lines }: { icon: keyof typeof Feather.glyphMap; title: string; lines: string[] }) {
  return (
    <View style={styles.infoSection}>
      <View style={styles.infoSectionTitle}>
        <Feather name={icon} size={18} color={colors.textPrimary} />
        <Text style={styles.profileName}>{title}</Text>
      </View>
      {lines.map((line) => (
        <Text key={line} style={styles.mutedText}>{line}</Text>
      ))}
    </View>
  );
}

function GuideTile({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.guideTile, pressed && onPress ? styles.guideTilePressed : null]}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
    >
      <Feather name={icon} size={24} color={colors.white} />
      <Text style={styles.guideTileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  guideContent: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 96 },
  bigTitle: {
    marginTop: 14,
    marginBottom: 24,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageTitle: { fontSize: 40, fontWeight: '800', color: colors.textPrimary, marginBottom: 22 },
  heroTitle: { fontSize: 36, lineHeight: 44, fontWeight: '800', color: colors.textPrimary },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginTop: 22 },
  sectionHint: {
    marginTop: 6,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  guideHomeSectionTitle: { fontSize: 26, lineHeight: 32, fontWeight: '800', color: colors.textPrimary },
  statsLoader: { marginTop: 8, marginBottom: 4 },
  statBlock: { marginTop: 28, flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusContent: { flex: 1, paddingHorizontal: 28, paddingTop: 40 },
  statusTitle: { fontSize: 32, lineHeight: 44, fontWeight: '800', color: colors.textPrimary },
  statusTitleLarge: { fontSize: 42, lineHeight: 52, fontWeight: '800', color: colors.textPrimary },
  statusSubtitle: { marginTop: 26, fontSize: 26, color: colors.textSubtle, fontWeight: '700' },
  rejectReason: { marginTop: 26, fontSize: 28, lineHeight: 38, color: colors.textPrimary, fontWeight: '700' },
  bottomActions: { marginTop: 'auto', paddingBottom: 76, gap: 18, alignItems: 'center' },
  centerButton: { alignSelf: 'center', marginTop: 28, minWidth: 240 },
  centerButtonSmall: { alignSelf: 'center', marginTop: 12, minWidth: 190 },
  alignStartButton: { alignSelf: 'flex-start', minWidth: 220, marginBottom: 28 },
  createButton: { alignSelf: 'center', minWidth: 250, marginTop: 42 },
  stubRow: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  errorText: {
    marginTop: 12,
    color: colors.errorText,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  field: { marginTop: 18 },
  fieldLabelStrong: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  input: {
    minHeight: 50,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  largeTextarea: { minHeight: 138 },
  contactsTextarea: { minHeight: 138 },
  tourTextarea: { minHeight: 100 },
  underlineWrap: { marginTop: 18 },
  underlineRow: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  underlineInput: { flex: 1, color: colors.textPrimary, fontSize: 18, paddingVertical: 4 },
  suffixText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  chipsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.accentButton, borderColor: colors.accentButton },
  chipText: { color: colors.textPrimary, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  choiceGroup: { marginTop: 18, gap: 10 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  checkLabel: { flex: 1, color: colors.textSubtle, fontSize: 14, fontWeight: '700' },
  imagePicker: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: colors.tileSage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  imagePickerPreview: { width: '100%', height: '100%' },
  imagePickerText: { marginTop: 8, color: colors.white, fontSize: 16, fontWeight: '800' },
  imagePickerHint: {
    marginBottom: 18,
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  meetingHint: {
    marginTop: 4,
    marginBottom: 12,
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  meetingResolved: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  infoRow: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 18 },
  infoRowCompact: { marginTop: 14, gap: 14 },
  infoText: { flex: 1, color: colors.textSubtle, fontSize: 22, lineHeight: 28, fontWeight: '700' },
  infoTextCompact: { fontSize: 20, lineHeight: 26 },
  nearestText: { marginTop: 10, color: colors.textPrimary, fontSize: 26, lineHeight: 34, fontWeight: '700' },
  nearestTextCompact: { marginTop: 10, color: colors.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: '700' },
  emptyText: { marginTop: 14, color: colors.textSubtle, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  outlineBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  outlineBtnText: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  tourGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 28, rowGap: 30 },
  miniCard: { width: '45%', position: 'relative' },
  miniImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.line },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tileSage },
  ratingPill: {
    position: 'absolute',
    right: 6,
    top: 70,
    backgroundColor: colors.overlayCard,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  ratingText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  miniTitle: { marginTop: 12, color: colors.textPrimary, fontSize: 22, lineHeight: 27, fontWeight: '800' },
  miniMeta: { marginTop: 6, color: colors.textSubtle, fontSize: 16, fontWeight: '700' },
  detailsBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.textPrimary,
    borderRadius: 10,
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  detailsBtnText: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  bookingPerson: { marginTop: 28 },
  bookingName: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 12 },
  bookingText: { color: colors.textPrimary, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  slotsBlock: { marginTop: 8, marginBottom: 12, gap: 10 },
  slotRow: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  slotRowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  profileTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 20 },
  profileRow: { flexDirection: 'row', gap: 16 },
  avatar: { width: 120, height: 156, borderRadius: 8, backgroundColor: colors.line },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  editAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  editAvatarActions: { flex: 1, gap: 10 },
  editAvatarBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentButton,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editAvatarBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  editAvatarGhostBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editAvatarGhostBtnText: { color: colors.textSubtle, fontWeight: '700', fontSize: 14 },
  profileMeta: { flex: 1, gap: 7 },
  profileName: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  mutedText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  reviewLink: { color: colors.textPrimary, textDecorationLine: 'underline', fontSize: 13 },
  smallGreenBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentButton,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallGreenBtnText: { color: colors.white, fontWeight: '700' },
  bioText: {
    marginTop: 22,
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'justify',
    fontWeight: '700',
  },
  infoSection: { marginTop: 22 },
  infoSectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  tilesRow: { flexDirection: 'row', gap: 16, marginTop: 18 },
  logoutGuideBtn: {
    marginTop: 26,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutGuideText: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  guideTile: {
    width: 136,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.tileSageLight,
    padding: 14,
    justifyContent: 'space-between',
  },
  guideTilePressed: { opacity: 0.85 },
  guideTileText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  detailImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.line },
  manageTitle: { marginTop: 20, color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  manageDescription: { marginTop: 18, color: colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  accText: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 6 },
});
