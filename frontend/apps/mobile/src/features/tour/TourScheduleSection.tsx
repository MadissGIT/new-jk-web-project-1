import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  formatTourScheduleLabel,
  type SlotLike,
} from '../../entities/tour/formatSchedule';
import { colors } from '../../shared/theme/colors';

type Props = {
  durationMinutes: number;
  slots?: SlotLike[];
  fallbackSchedule?: string | null;
  isLoading?: boolean;
  titleStyle?: object;
  title?: string;
};

export function TourScheduleSection({
  durationMinutes,
  slots,
  fallbackSchedule,
  isLoading = false,
  titleStyle,
  title = 'Расписание',
}: Props) {
  const label = formatTourScheduleLabel(durationMinutes, slots, fallbackSchedule);

  return (
    <View style={styles.block}>
      {title ? <Text style={[styles.blockTitle, titleStyle]}>{title}</Text> : null}
      {isLoading ? (
        <ActivityIndicator color={colors.textPrimary} style={styles.loader} />
      ) : (
        <View style={styles.row}>
          <Feather name="clock" size={18} color={colors.textPrimary} />
          <Text style={styles.text}>{label}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 8,
  },
  blockTitle: {
    marginTop: 10,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  loader: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
