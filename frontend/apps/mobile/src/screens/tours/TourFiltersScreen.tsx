import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type TourInterestFilter,
  useTourFiltersStore,
} from '../../entities/tour/tourUiStore';
import type { AccessibilityId } from '../../entities/preferences/preferencesStore';
import { colors } from '../../shared/theme/colors';
import { SaveButton } from '../../shared/ui/SaveButton';

const interestOptions: Array<{ id: TourInterestFilter; label: string }> = [
  { id: 'coffee', label: 'Гастро' },
  { id: 'art', label: 'Арт' },
  { id: 'walk', label: 'Прогулки' },
  { id: 'history', label: 'История' },
  { id: 'nature', label: 'Природа' },
  { id: 'music', label: 'Музыка' },
];

const accessibilityOptions: Array<{ id: AccessibilityId; label: string }> = [
  { id: 'wheelchair', label: 'Передвигаюсь с коляской' },
  { id: 'cane', label: 'Использую трость' },
  { id: 'ramps', label: 'Нужны пандусы' },
  { id: 'avoid_stairs', label: 'Избегать лестниц' },
  { id: 'hearing', label: 'Проблемы со слухом' },
  { id: 'none', label: 'Нет ограничений' },
];

export function TourFiltersScreen() {
  const navigation = useNavigation();
  const priceMin = useTourFiltersStore((s) => s.priceMin);
  const priceMax = useTourFiltersStore((s) => s.priceMax);
  const durationMinHours = useTourFiltersStore((s) => s.durationMinHours);
  const durationMaxHours = useTourFiltersStore((s) => s.durationMaxHours);
  const interests = useTourFiltersStore((s) => s.interests);
  const accessibility = useTourFiltersStore((s) => s.accessibility);
  const radiusMeters = useTourFiltersStore((s) => s.radiusMeters);
  const setPrice = useTourFiltersStore((s) => s.setPrice);
  const setDuration = useTourFiltersStore((s) => s.setDuration);
  const toggleInterest = useTourFiltersStore((s) => s.toggleInterest);
  const toggleAccessibility = useTourFiltersStore((s) => s.toggleAccessibility);
  const setRadiusMeters = useTourFiltersStore((s) => s.setRadiusMeters);
  const resetFilters = useTourFiltersStore((s) => s.resetFilters);

  const [priceMinInput, setPriceMinInput] = useState(
    priceMin != null ? String(priceMin) : '',
  );
  const [priceMaxInput, setPriceMaxInput] = useState(
    priceMax != null ? String(priceMax) : '',
  );
  const [durationMinInput, setDurationMinInput] = useState(
    durationMinHours != null ? String(durationMinHours) : '',
  );
  const [durationMaxInput, setDurationMaxInput] = useState(
    durationMaxHours != null ? String(durationMaxHours) : '',
  );
  const [radiusInput, setRadiusInput] = useState(
    radiusMeters ? String(radiusMeters) : '',
  );

  const formError = useMemo(() => {
    const minPrice = priceMinInput.trim() ? Number(priceMinInput) : null;
    const maxPrice = priceMaxInput.trim() ? Number(priceMaxInput) : null;
    const minDuration = durationMinInput.trim() ? Number(durationMinInput) : null;
    const maxDuration = durationMaxInput.trim() ? Number(durationMaxInput) : null;
    const radius = radiusInput.trim() ? Number(radiusInput) : null;

    const numbers = [minPrice, maxPrice, minDuration, maxDuration].filter(
      (value): value is number => value != null,
    );
    if (numbers.some(Number.isNaN)) {
      return 'Проверьте числовые поля';
    }
    if (minPrice != null && minPrice < 0) return 'Проверьте цену';
    if (minPrice != null && maxPrice != null && maxPrice < minPrice) return 'Проверьте цену';
    if (minDuration != null && minDuration < 1) return 'Минимум 1 час';
    if (minDuration != null && maxDuration != null && maxDuration < minDuration) {
      return 'Проверьте длительность';
    }
    if (radius !== null && (Number.isNaN(radius) || radius < 100 || radius > 20000)) {
      return 'Радиус: от 100 до 20000 метров';
    }
    return null;
  }, [durationMaxInput, durationMinInput, priceMaxInput, priceMinInput, radiusInput]);

  const apply = () => {
    if (formError) return;
    setPrice(
      priceMinInput.trim() ? Number(priceMinInput) : null,
      priceMaxInput.trim() ? Number(priceMaxInput) : null,
    );
    setDuration(
      durationMinInput.trim() ? Number(durationMinInput) : null,
      durationMaxInput.trim() ? Number(durationMaxInput) : null,
    );
    setRadiusMeters(radiusInput.trim() ? Number(radiusInput) : null);
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Цена</Text>
        <View style={styles.inlineInputs}>
          <Text style={styles.prefix}>от</Text>
          <TextInput
            value={priceMinInput}
            onChangeText={setPriceMinInput}
            keyboardType="number-pad"
            style={styles.smallInput}
          />
          <Text style={styles.prefix}>руб. до</Text>
          <TextInput
            value={priceMaxInput}
            onChangeText={setPriceMaxInput}
            keyboardType="number-pad"
            style={styles.smallInput}
          />
          <Text style={styles.prefix}>руб.</Text>
        </View>

        <Text style={styles.sectionTitle}>Длительность</Text>
        <View style={styles.inlineInputs}>
          <Text style={styles.prefix}>от</Text>
          <TextInput
            value={durationMinInput}
            onChangeText={setDurationMinInput}
            keyboardType="number-pad"
            style={styles.durationInput}
          />
          <Text style={styles.prefix}>час. до</Text>
          <TextInput
            value={durationMaxInput}
            onChangeText={setDurationMaxInput}
            keyboardType="number-pad"
            style={styles.durationInput}
          />
          <Text style={styles.prefix}>час.</Text>
        </View>

        <Text style={styles.sectionTitle}>Интересы</Text>
        <View style={styles.optionsWrap}>
          {interestOptions.map((item) => (
            <Pressable
              key={item.id}
              style={styles.optionRow}
              onPress={() => toggleInterest(item.id)}
            >
              <View
                style={[
                  styles.checkbox,
                  interests.includes(item.id) && styles.checkboxActive,
                ]}
              >
                {interests.includes(item.id) ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={styles.optionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Доступность</Text>
        <View style={styles.optionsWrap}>
          {accessibilityOptions.map((item) => (
            <Pressable
              key={item.id}
              style={styles.optionRow}
              onPress={() => toggleAccessibility(item.id)}
            >
              <View
                style={[
                  styles.checkbox,
                  accessibility.includes(item.id) && styles.checkboxActive,
                ]}
              >
                {accessibility.includes(item.id) ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <Text style={styles.optionLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Радиус</Text>
        <TextInput
          value={radiusInput}
          onChangeText={setRadiusInput}
          keyboardType="number-pad"
          placeholder="Например: 2000"
          placeholderTextColor={colors.textMuted}
          style={styles.fullInput}
        />

        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        <Pressable
          style={styles.resetBtn}
          onPress={() => {
            resetFilters();
            setPriceMinInput('');
            setPriceMaxInput('');
            setDurationMinInput('');
            setDurationMaxInput('');
            setRadiusInput('');
          }}
        >
          <Text style={styles.resetText}>Сбросить фильтры</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.footer}>
        <SaveButton title="Применить" onPress={apply} disabled={Boolean(formError)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 22 },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  inlineInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  prefix: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  smallInput: {
    width: 92,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  durationInput: {
    width: 76,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  optionsWrap: { gap: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkboxActive: { backgroundColor: colors.white },
  check: { color: colors.textPrimary, fontSize: 15, fontWeight: '800', lineHeight: 18 },
  optionLabel: { color: colors.textPrimary, fontSize: 16 },
  fullInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  errorText: { marginTop: 10, color: colors.errorText, fontWeight: '700' },
  resetBtn: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  resetText: { color: colors.textPrimary, fontWeight: '700' },
  footer: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10 },
});
