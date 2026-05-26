import { Feather } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  getTourAccessibilityView,
  isTourAccessibilitySpecified,
} from '../../entities/tour/accessibility';
import { colors } from '../../shared/theme/colors';

type Props = {
  accessibility: { wheelchair_accessible: boolean; avoid_stairs_possible: boolean };
  tags?: string[];
  titleStyle?: object;
  /** Заголовок блока; по умолчанию «Доступность». */
  title?: string;
};

function AccessibilityLine({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.accRow}>
      <Feather name={value ? 'check' : 'x'} size={18} color={colors.textPrimary} />
      <Text style={styles.accItem}>{label}</Text>
    </View>
  );
}

export function TourAccessibilitySection({
  accessibility,
  tags,
  titleStyle,
  title = 'Доступность',
}: Props) {
  const specified = isTourAccessibilitySpecified(accessibility, tags);
  const view = getTourAccessibilityView(accessibility, tags);

  return (
    <>
      {title ? <Text style={[styles.blockTitle, titleStyle]}>{title}</Text> : null}
      {specified ? (
        <View style={styles.accList}>
          <AccessibilityLine label="пандус" value={view.ramp} />
          <AccessibilityLine label="широкие проходы" value={view.widePassages} />
          <AccessibilityLine label="ступени" value={view.stairs} />
        </View>
      ) : (
        <Text style={styles.unspecified}>
          Гид не указал особенности доступности маршрута
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  blockTitle: {
    marginTop: 18,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  accList: { gap: 8 },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accItem: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  unspecified: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
});
