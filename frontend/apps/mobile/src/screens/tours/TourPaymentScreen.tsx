import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';

import { useBookingDetail, useConfirmMockPayment } from '../../entities/tour/hooks';
import type { MainStackParamList } from '../../navigation/MainNavigator';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { SaveButton } from '../../shared/ui/SaveButton';

type Props = NativeStackScreenProps<MainStackParamList, 'TourPayment'>;

type PaymentMethodId =
  | 'yandex_pay'
  | 'yandex_split'
  | 'podeli'
  | 'dolyami'
  | 'sbp'
  | 'new_card'
  | 'sberpay'
  | 'tpay';

type MethodRow = {
  id: PaymentMethodId;
  title: string;
  subtitle?: string;
  icon?: ImageSourcePropType;
  mark?: string;
  bullets?: string[];
};

const PAYMENT_METHODS: MethodRow[] = [
  {
    id: 'yandex_pay',
    title: 'Яндекс Пэй',
    icon: require('../../../assets/payment/yandex-pay.jpg'),
  },
  {
    id: 'yandex_split',
    title: 'Сплит — частями',
    icon: require('../../../assets/payment/split.jpg'),
  },
  {
    id: 'podeli',
    title: 'Подели — частями',
    subtitle: 'с помощью Подели',
    icon: require('../../../assets/payment/podeli.png'),
  },
  { id: 'dolyami', title: 'Долями', mark: 'Д' },
  {
    id: 'sbp',
    title: 'СБП',
    icon: require('../../../assets/payment/sbp.png'),
    bullets: [
      'Выберите банк из списка',
      'Подтвердите платёж в банковском приложении',
    ],
  },
  {
    id: 'new_card',
    title: 'Новой картой',
    icon: require('../../../assets/payment/new-card.png'),
  },
  {
    id: 'sberpay',
    title: 'SberPay',
    subtitle: 'Быстрая оплата со Сбером',
    icon: require('../../../assets/payment/sberpay.jpg'),
  },
  {
    id: 'tpay',
    title: 'T-Pay',
    icon: require('../../../assets/payment/tpay.jpg'),
  },
];

const FOOTER_LEGAL =
  'Завершая оформление заказа, я соглашаюсь с Условиями продажи. Публичной офертой';

export function TourPaymentScreen({ route, navigation }: Props) {
  const { bookingId } = route.params;
  const queryClient = useQueryClient();
  const detail = useBookingDetail(bookingId);
  const confirmPayment = useConfirmMockPayment();
  const [selected, setSelected] = useState<PaymentMethodId>('sbp');

  const invalidateBooking = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings', 'detail', bookingId] });
    await queryClient.invalidateQueries({ queryKey: ['bookings', 'list'] });
  };

  const handlePay = async () => {
    if (confirmPayment.isPending) return;
    try {
      await confirmPayment.mutateAsync(bookingId);
      await invalidateBooking();
      navigation.replace('BookingPaymentSuccess', { bookingId });
    } catch (e) {
      navigation.navigate('BookingPaymentError', {
        bookingId,
        errorMessage: extractApiError(e),
      });
    }
  };

  if (detail.isLoading) {
    return (
      <View style={styles.center}>
        <Text style={styles.meta}>Загрузка...</Text>
      </View>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{extractApiError(detail.error)}</Text>
      </View>
    );
  }

  const booking = detail.data;
  const amount = booking.price_total.amount.toLocaleString('ru-RU');
  const qty = booking.participants_count;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader />
        <Text style={styles.title}>
          Оплата:{'\n'}
          {booking.tour.title}
        </Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Итого:</Text>
          <Text style={styles.totalValue}>
            {qty} × {amount} р.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Метод оплаты</Text>

        <View style={styles.card}>
          {PAYMENT_METHODS.map((m) => {
            const active = selected === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => setSelected(m.id)}
                style={[styles.row, active && styles.rowSelected]}
              >
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.methodMark}>
                  {m.icon ? (
                    <Image
                      source={m.icon}
                      style={styles.methodIcon}
                      resizeMode="contain"
                      accessibilityLabel={m.title}
                    />
                  ) : (
                    <Text style={styles.methodMarkText}>{m.mark}</Text>
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{m.title}</Text>
                  {m.subtitle ? <Text style={styles.rowSubtitle}>{m.subtitle}</Text> : null}
                  {active && m.bullets?.length ? (
                    <View style={styles.bullets}>
                      {m.bullets.map((line, i) => (
                        <View key={line} style={styles.bulletLine}>
                          <View
                            style={[
                              styles.bulletIcon,
                              i === m.bullets!.length - 1 && styles.bulletIconActive,
                            ]}
                          />
                          <Text style={styles.bulletText}>{line}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.legal}>{FOOTER_LEGAL}</Text>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <SaveButton
          style={styles.payBtnWide}
          title={confirmPayment.isPending ? 'Оплата...' : 'Оплатить'}
          onPress={handlePay}
          loading={confirmPayment.isPending}
          disabled={
            booking.status !== 'pending_payment' || confirmPayment.isPending
          }
        />
        {booking.status !== 'pending_payment' ? (
          <Text style={styles.hintMuted}>Эта бронь уже не ожидает оплату.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  meta: { color: colors.textMuted },
  errorText: { color: colors.errorText, textAlign: 'center' },
  title: {
    marginTop: 8,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionLabel: {
    marginTop: 22,
    marginBottom: 10,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowSelected: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
    marginHorizontal: -1,
    marginVertical: -StyleSheet.hairlineWidth,
    borderRadius: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.textPrimary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.textPrimary,
    backgroundColor: colors.textPrimary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  methodMark: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIcon: { width: 30, height: 26, borderRadius: 5 },
  methodMarkText: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  rowSubtitle: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  bullets: { marginTop: 10, gap: 8 },
  bulletLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletIcon: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 5,
    backgroundColor: 'transparent',
  },
  bulletIconActive: {
    backgroundColor: colors.statusActive,
    borderColor: colors.statusActive,
  },
  bulletText: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 18 },
  legal: {
    marginTop: 20,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.background,
    alignItems: 'stretch',
  },
  payBtnWide: {
    alignSelf: 'stretch',
  },
  hintMuted: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
  },
});
