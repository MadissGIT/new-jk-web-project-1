import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuthStore } from '../../entities/auth/authStore';
import { useGuideModeStore } from '../../entities/guide/guideModeStore';
import {
  formatTourScheduleLabel,
  getSlotLifecycle,
  getTourSlotState,
  parseApiDateTime,
} from '../../entities/tour/formatSchedule';
import { useConfirmMockPayment, useCreateBooking, useTour, useTourSlots } from '../../entities/tour/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';

type Props = NativeStackScreenProps<MainStackParamList, 'TourBooking'>;

type PaymentMethodId =
  | 'yandex_pay'
  | 'split'
  | 'podeli'
  | 'dolyami'
  | 'sbp'
  | 'new_card'
  | 'sberpay'
  | 'tpay';

const PAYMENT_METHODS: Array<{
  id: PaymentMethodId;
  title: string;
  subtitle?: string;
  mark: string;
  bullets?: string[];
}> = [
  { id: 'yandex_pay', title: 'Яндекс Пэй', mark: 'Я' },
  { id: 'split', title: 'Сплит — частями', mark: 'S' },
  { id: 'podeli', title: 'Подели — частями', subtitle: 'с помощью Подели', mark: 'P' },
  { id: 'dolyami', title: 'Долями', mark: 'Д' },
  {
    id: 'sbp',
    title: 'СБП',
    mark: '▶',
    bullets: ['Выберите банк из списка', 'Подтвердите платёж в банковском приложении'],
  },
  { id: 'new_card', title: 'Новой картой', mark: '▭' },
  { id: 'sberpay', title: 'SberPay', subtitle: 'Быстрая оплата со Сбером', mark: 'Pay' },
  { id: 'tpay', title: 'T-Pay', mark: 'T' },
];

function formatDateKey(value: string) {
  const date = parseApiDateTime(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatSlotDate(value: string) {
  return parseApiDateTime(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  });
}

export function TourBookingScreen({ route, navigation }: Props) {
  const { tourId } = route.params;
  const tour = useTour(tourId);
  const user = useAuthStore((s) => s.user);
  const localTour = useGuideModeStore((s) => s.tours.find((item) => item.id === tourId));
  const addLocalBooking = useGuideModeStore((s) => s.addBooking);
  const slots = useTourSlots(tourId);
  const createBooking = useCreateBooking();
  const confirmPayment = useConfirmMockPayment();
  const queryClient = useQueryClient();
  const [participants, setParticipants] = useState('1');
  const [comment, setComment] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const durationMinutes = tour.data?.duration_minutes ?? (localTour ? localTour.durationHours * 60 : 240);

  const availableSlots = useMemo(
    () =>
      (slots.data ?? [])
        .filter(
          (slot) =>
            slot.status === 'available' &&
            slot.available_capacity > 0 &&
            getSlotLifecycle(slot, durationMinutes) === 'upcoming',
        )
        .sort(
          (a, b) =>
            parseApiDateTime(a.starts_at).getTime() - parseApiDateTime(b.starts_at).getTime(),
        ),
    [durationMinutes, slots.data],
  );
  const slotState = useMemo(
    () => getTourSlotState(slots.data, durationMinutes),
    [durationMinutes, slots.data],
  );
  const effectiveSlotId = selectedSlotId ?? availableSlots[0]?.id ?? null;
  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.id === effectiveSlotId) ?? availableSlots[0] ?? null,
    [availableSlots, effectiveSlotId],
  );
  const selectedDateKey = selectedSlot ? formatDateKey(selectedSlot.starts_at) : null;
  const dateOptions = useMemo(() => {
    const seen = new Set<string>();
    return availableSlots.filter((slot) => {
      const key = formatDateKey(slot.starts_at);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [availableSlots]);
  const timeOptions = useMemo(
    () =>
      selectedDateKey
        ? availableSlots.filter((slot) => formatDateKey(slot.starts_at) === selectedDateKey)
        : availableSlots,
    [availableSlots, selectedDateKey],
  );
  const participantsCount = Math.max(1, Number.parseInt(participants, 10) || 1);
  const maxCapacity = selectedSlot?.available_capacity ?? 0;
  const participantsOverflow = maxCapacity > 0 && participantsCount > maxCapacity;
  const unitPrice = selectedSlot?.price.amount ?? tour.data?.price.amount ?? 0;

  const totalPrice = useMemo(() => {
    return unitPrice * participantsCount;
  }, [participantsCount, unitPrice]);

  const slotDate = selectedSlot ? formatSlotDate(selectedSlot.starts_at) : 'Нет слотов';
  const slotTime = selectedSlot
    ? parseApiDateTime(selectedSlot.starts_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  const unavailableReason =
    !selectedSlot && slotState.status === 'active'
      ? 'Тур уже идет, запись закрыта'
      : !selectedSlot && slotState.status === 'ended'
        ? 'Тур уже прошел'
        : null;

  const invalidateBookingState = async (bookingId: string) => {
    await queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] });
    await queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
    await queryClient.invalidateQueries({ queryKey: ['tours', 'slots', tourId] });
  };

  const handleBook = async (next: 'payment' | 'defer') => {
    if (
      !selectedSlot ||
      getSlotLifecycle(selectedSlot, durationMinutes) !== 'upcoming' ||
      participantsOverflow ||
      createBooking.isPending ||
      confirmPayment.isPending
    ) return;
    const idempotency_key = `${tourId}-${selectedSlot.id}-${Date.now()}`;
    const booking = await createBooking.mutateAsync({
      tour_id: tourId,
      slot_id: selectedSlot.id,
      participants_count: participantsCount,
      comment: comment.trim() || undefined,
      idempotency_key,
    });
    if (next === 'payment') {
      await confirmPayment.mutateAsync(booking.id);
      await invalidateBookingState(booking.id);
      setPaymentOpen(false);
      navigation.replace('BookingPaymentSuccess', { bookingId: booking.id });
      return;
    }
    setPaymentOpen(false);
    navigation.navigate('TourDeferred', { tourId, bookingId: booking.id });
  };

  if (localTour) {
    const participantsCount = Math.max(1, Number.parseInt(participants, 10) || 1);
    const totalPrice = participantsCount * localTour.price;
    const localSlot = localTour.slotStartsAt ? { starts_at: localTour.slotStartsAt } : null;
    const localLifecycle = localSlot ? getSlotLifecycle(localSlot, localTour.durationHours * 60) : 'upcoming';
    const localBookingClosed = localLifecycle !== 'upcoming';
    const handleLocalPayment = () => {
      if (localBookingClosed) return;
      addLocalBooking({
        tourId: localTour.id,
        customerName: user ? [user.surname, user.name].filter(Boolean).join(' ') || user.email : 'Гость',
        participantsCount,
        contact: user?.email ?? 'контакт не указан',
        comment: comment.trim(),
      });
      setLocalSuccess('Оплата прошла. Вы записались на тур, заявка появилась в бронированиях гида.');
    };

    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <ScreenHeader />
        <Text style={styles.title}>Бронирование: {localTour.title}</Text>
        <Text style={styles.meta}>
          {formatTourScheduleLabel(
            localTour.durationHours * 60,
            localSlot ? [localSlot] : undefined,
            localTour.scheduleLabel,
          )}
        </Text>
        <Text style={styles.meta}>Тур займет около {localTour.durationHours} часов</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Количество человек:</Text>
          <TextInput
            value={String(participantsCount)}
            onChangeText={(value) => setParticipants(value.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
            style={styles.smallInput}
          />
        </View>
        <Text style={styles.meta}>Осталось {localTour.maxPeople} мест</Text>
        <Text style={[styles.label, { marginTop: 10 }]}>Комментарий гиду:</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          style={styles.comment}
          multiline
          placeholder="Что необходимо знать гиду..."
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Итого:</Text>
          <Text style={styles.totalValue}>
            {participantsCount} x {localTour.price.toLocaleString('ru-RU')} = {totalPrice.toLocaleString('ru-RU')} р.
          </Text>
        </View>
        {localBookingClosed ? (
          <Text style={styles.errorText}>
            {localLifecycle === 'active' ? 'Тур уже идет, запись закрыта' : 'Тур уже прошел'}
          </Text>
        ) : null}
        <Pressable
          style={[styles.primaryBtn, localBookingClosed && styles.disabledBtn]}
          disabled={localBookingClosed}
          onPress={() => setPaymentOpen(true)}
        >
          <Text style={styles.primaryBtnText}>Записаться и оплатить</Text>
        </Pressable>
        {localSuccess ? <Text style={styles.successText}>{localSuccess}</Text> : null}
        <MockPaymentModal
          visible={paymentOpen}
          title={localTour.title}
          totalPrice={totalPrice}
          participantsCount={participantsCount}
          loading={false}
          onClose={() => setPaymentOpen(false)}
          onPay={handleLocalPayment}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <ScreenHeader />
      <Text style={styles.title}>Бронирование: {tour.data?.title ?? 'Тур'}</Text>
      {slots.isLoading ? (
        <Text style={styles.meta}>Загружаем доступные слоты...</Text>
      ) : null}
      {slots.isError ? (
        <Text style={styles.errorText}>{extractApiError(slots.error)}</Text>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>Дата:</Text>
        <Pressable style={styles.valueChip} onPress={() => setCalendarOpen(true)}>
          <Text style={styles.valueText}>{slotDate}</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Начало:</Text>
        <Pressable style={styles.valueChip} onPress={() => setTimeOpen((v) => !v)}>
          <Text style={styles.valueText}>{slotTime}</Text>
          <Feather name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
        {timeOpen ? (
          <View style={styles.timePopover}>
            {timeOptions.map((slot) => {
              const label = parseApiDateTime(slot.starts_at).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
              <Pressable
                key={slot.id}
                style={styles.timeOption}
                onPress={() => {
                  setSelectedSlotId(slot.id);
                  setTimeOpen(false);
                }}
              >
                <Text style={styles.timeOptionText}>{label}</Text>
              </Pressable>
              );
            })}
            {timeOptions.length === 0 ? (
              <Text style={styles.timeOptionText}>Доступных слотов нет</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={styles.meta}>Тур займет около {Math.max(1, Math.round(durationMinutes / 60))} часов</Text>
      {unavailableReason ? <Text style={styles.errorText}>{unavailableReason}</Text> : null}

      <View style={styles.row}>
        <Text style={styles.label}>Количество человек:</Text>
        <TextInput
          value={String(participantsCount)}
          onChangeText={(value) => setParticipants(value.replace(/[^0-9]/g, '').slice(0, 2))}
          keyboardType="number-pad"
          style={styles.smallInput}
        />
      </View>
      <Text style={styles.meta}>
        Осталось {selectedSlot?.available_capacity ?? 0} мест
      </Text>
      {participantsOverflow ? (
        <Text style={styles.errorText}>Количество участников превышает доступные места в слоте</Text>
      ) : null}

      <Text style={[styles.label, { marginTop: 10 }]}>Добавить комментарий:</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        style={styles.comment}
        multiline
        placeholder="Здесь вы можете написать то, что необходимо знать гиду..."
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Итого:</Text>
        <Text style={styles.totalValue}>
          {participantsCount} x {unitPrice.toLocaleString('ru-RU')} = {totalPrice.toLocaleString('ru-RU')} р.
        </Text>
      </View>

      <Pressable
        style={[
          styles.primaryBtn,
          (!selectedSlot || participantsOverflow || createBooking.isPending) && styles.disabledBtn,
        ]}
        disabled={!selectedSlot || participantsOverflow || createBooking.isPending}
        onPress={() => setPaymentOpen(true)}
      >
        <Text style={styles.primaryBtnText}>Записаться и оплатить</Text>
      </Pressable>
      <Pressable
        style={[
          styles.primaryBtn,
          styles.secondaryBtn,
          (!selectedSlot || participantsOverflow || createBooking.isPending) && styles.disabledBtn,
        ]}
        disabled={!selectedSlot || participantsOverflow || createBooking.isPending}
        onPress={() => handleBook('defer')}
      >
        <Text style={styles.primaryBtnText}>Оплачу позже</Text>
      </Pressable>
      {createBooking.isError ? (
        <Text style={styles.errorText}>{extractApiError(createBooking.error)}</Text>
      ) : null}

      <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCalendarOpen(false)}>
          <View style={styles.calendarCard}>
            <View style={styles.calendarHead}>
              <Text style={styles.calendarTitle}>Доступные даты</Text>
            </View>
            {dateOptions.length === 0 ? (
              <Text style={styles.emptyText}>Слотов пока нет</Text>
            ) : null}
            {dateOptions.map((slot) => {
              const active = selectedDateKey === formatDateKey(slot.starts_at);
              return (
                <Pressable
                  key={formatDateKey(slot.starts_at)}
                  style={[styles.dateOption, active && styles.dateOptionActive]}
                  onPress={() => {
                    setSelectedSlotId(slot.id);
                    setCalendarOpen(false);
                  }}
                >
                  <Text style={[styles.dateOptionText, active && styles.dateOptionTextActive]}>
                    {formatSlotDate(slot.starts_at)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      <MockPaymentModal
        visible={paymentOpen}
        title={tour.data?.title ?? 'Тур'}
        totalPrice={totalPrice}
        participantsCount={participantsCount}
        loading={createBooking.isPending || confirmPayment.isPending}
        onClose={() => setPaymentOpen(false)}
        onPay={() => handleBook('payment')}
      />
    </ScrollView>
  );
}

function MockPaymentModal({
  visible,
  title,
  totalPrice,
  participantsCount,
  loading,
  onClose,
  onPay,
}: {
  visible: boolean;
  title: string;
  totalPrice: number;
  participantsCount: number;
  loading: boolean;
  onClose: () => void;
  onPay: () => void | Promise<void>;
}) {
  const [selected, setSelected] = useState<PaymentMethodId>('sbp');
  const [result, setResult] = useState<'form' | 'success' | 'error'>('form');

  useEffect(() => {
    if (visible) setResult('form');
  }, [visible]);

  const handlePay = async () => {
    try {
      await onPay();
      setResult('success');
    } catch {
      setResult('error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.paymentOverlay}>
        <View style={styles.paymentScreen}>
          <ScreenHeader />
          {result === 'success' ? (
            <View style={styles.paymentResultBody}>
              <Text style={styles.paymentScreenTitle}>Бронирование тура{'\n'}подтверждено</Text>
              <View style={styles.confirmBlock}>
                <Text style={styles.confirmLine}>
                  <Text style={styles.confirmEm}>Тур: </Text>
                  {title}
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={styles.confirmEm}>Участников: </Text>
                  {participantsCount}
                </Text>
                <Text style={styles.confirmLine}>
                  <Text style={styles.confirmEm}>Оплата: </Text>
                  {totalPrice.toLocaleString('ru-RU')} р.
                </Text>
              </View>
              <View style={styles.resultActions}>
                <Pressable style={styles.primaryBtn} onPress={onClose}>
                  <Text style={styles.primaryBtnText}>Смотреть тур</Text>
                </Pressable>
              </View>
            </View>
          ) : result === 'error' ? (
            <View style={styles.paymentResultBody}>
              <Text style={styles.paymentScreenTitle}>Во время оплаты{'\n'}произошла ошибка</Text>
              <Text style={styles.paymentErrorText}>Информация об ошибке (если есть)</Text>
              <View style={styles.resultActions}>
                <Pressable style={styles.primaryBtn} onPress={() => setResult('form')}>
                  <Text style={styles.primaryBtnText}>Попробовать снова</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.paymentScreenTitle}>Оплата: {title}</Text>
              <View style={styles.paymentTotalRow}>
                <Text style={styles.paymentTotalLabel}>Итого:</Text>
                <Text style={styles.paymentTotalValue}>
                  {participantsCount} × {totalPrice.toLocaleString('ru-RU')} р.
                </Text>
              </View>

              <Text style={styles.paymentSectionTitle}>Метод оплаты</Text>
              <View style={styles.paymentMethodsCard}>
                {PAYMENT_METHODS.map((method) => {
                  const active = selected === method.id;
                  return (
                    <Pressable
                      key={method.id}
                      style={[styles.methodRow, active && styles.methodRowActive]}
                      onPress={() => setSelected(method.id)}
                    >
                      <View style={[styles.methodRadio, active && styles.methodRadioActive]}>
                        {active ? <View style={styles.methodRadioDot} /> : null}
                      </View>
                      <View style={styles.methodMark}>
                        <Text style={styles.methodMarkText}>{method.mark}</Text>
                      </View>
                      <View style={styles.methodBody}>
                        <Text style={styles.methodTitle}>{method.title}</Text>
                        {method.subtitle ? <Text style={styles.methodSubtitle}>{method.subtitle}</Text> : null}
                        {active && method.bullets?.length ? (
                          <View style={styles.methodBullets}>
                            {method.bullets.map((line, index) => (
                              <View key={line} style={styles.methodBulletLine}>
                                <View style={[styles.methodBullet, index === 1 && styles.methodBulletActive]} />
                                <Text style={styles.methodBulletText}>{line}</Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.primaryBtn, styles.paymentPayButton, loading && styles.disabledBtn]}
                disabled={loading}
                onPress={handlePay}
              >
                <Text style={styles.primaryBtnText}>{loading ? 'Оплата...' : 'Оплатить'}</Text>
              </Pressable>
              <Text style={styles.paymentLegal}>
                Завершая оформление заказа, я соглашаюсь с Условиями продажи. Публичной офертой
              </Text>
            </>
          )}
          <Pressable style={styles.paymentCloseFloating} onPress={onClose}>
            <Feather name="x" size={20} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.paymentBottomSafe} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  title: { marginTop: 8, color: colors.textPrimary, fontWeight: '800', fontSize: 48 / 2, lineHeight: 29 },
  row: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 / 1.2 },
  valueChip: {
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueText: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 16 / 1.2 },
  smallInput: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  comment: {
    marginTop: 8,
    minHeight: 96,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 12,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  totalRow: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.textPrimary, fontSize: 34 / 2, fontWeight: '800' },
  totalValue: { color: colors.textPrimary, fontSize: 34 / 2, fontWeight: '800' },
  primaryBtn: {
    marginTop: 16,
    alignSelf: 'center',
    minWidth: 240,
    borderRadius: 12,
    backgroundColor: colors.accentButton,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  secondaryBtn: { backgroundColor: colors.tileSage },
  disabledBtn: { opacity: 0.5 },
  primaryBtnText: { color: colors.white, fontSize: 32 / 2, fontWeight: '700' },
  timePopover: {
    position: 'absolute',
    right: 0,
    top: 42,
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 10,
  },
  timeOption: { paddingHorizontal: 12, paddingVertical: 8 },
  timeOptionText: { color: colors.textPrimary, fontWeight: '600' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 12,
  },
  calendarHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { color: colors.textPrimary, fontSize: 28 / 2, fontWeight: '700' },
  dateOption: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  dateOptionActive: {
    borderColor: colors.accentButton,
    backgroundColor: colors.accentButton,
  },
  dateOptionText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  dateOptionTextActive: { color: colors.white },
  emptyText: { marginTop: 10, color: colors.textMuted, fontSize: 13 },
  errorText: { marginTop: 8, color: colors.errorText, fontSize: 12 },
  successText: { marginTop: 12, color: colors.successText, fontSize: 13, fontWeight: '700' },
  paymentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
  },
  paymentScreen: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  paymentScreenTitle: {
    marginTop: 8,
    color: colors.textPrimary,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
  },
  paymentTotalRow: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentTotalLabel: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  paymentTotalValue: { color: colors.accentDeep, fontSize: 20, fontWeight: '800' },
  paymentSectionTitle: {
    marginTop: 32,
    marginBottom: 12,
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  paymentMethodsCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  methodRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  methodRowActive: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
    borderRadius: 12,
    marginHorizontal: -1,
    marginVertical: -StyleSheet.hairlineWidth,
    borderBottomWidth: 2,
    borderBottomColor: colors.textPrimary,
  },
  methodRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  methodRadioActive: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },
  methodRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  methodMark: {
    minWidth: 34,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodMarkText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  methodBody: { flex: 1 },
  methodTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '800' },
  methodSubtitle: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  methodBullets: { marginTop: 18, gap: 12 },
  methodBulletLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  methodBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.statusPlanned,
  },
  methodBulletActive: { borderColor: colors.statusActive },
  methodBulletText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  paymentPayButton: { marginTop: 32, minWidth: 128 },
  paymentLegal: {
    marginTop: 28,
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
  },
  paymentCloseFloating: {
    position: 'absolute',
    top: 28,
    right: 18,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentBottomSafe: { height: 16 },
  paymentResultBody: { flex: 1 },
  confirmBlock: { marginTop: 120, gap: 18 },
  confirmLine: {
    color: colors.accentDeep,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '700',
  },
  confirmEm: { color: colors.textPrimary, fontWeight: '800' },
  resultActions: { marginTop: 'auto', paddingBottom: 76, alignItems: 'center', gap: 14 },
  paymentErrorText: {
    marginTop: 160,
    color: colors.textSubtle,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '800',
  },
});
