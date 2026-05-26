import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type AccessibilityId,
  type InterestId,
  type Tempo,
  usePreferencesStore,
} from '../../entities/preferences/preferencesStore';
import { toBudgetLevel } from '../../entities/preferences/api';
import { useSavePreferences } from '../../entities/preferences/hooks';
import { extractApiError } from '../../shared/api/http';
import { ScreenHeader } from '../../shared/ui/ScreenHeader';
import { SaveButton } from '../../shared/ui/SaveButton';
import { colors } from '../../shared/theme/colors';

const interestOptions: {
  id: InterestId;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}[] = [
  { id: 'art', label: 'Искусство', icon: 'feather' },
  { id: 'coffee', label: 'Кофе', icon: 'coffee' },
  { id: 'history', label: 'История', icon: 'book-open' },
  { id: 'nature', label: 'Природа', icon: 'cloud-drizzle' },
  { id: 'music', label: 'Музыка', icon: 'music' },
  { id: 'relax', label: 'Спокойный отдых', icon: 'smile' },
];

const accessibilityOptions: { id: AccessibilityId; label: string }[] = [
  { id: 'wheelchair', label: 'Передвигаюсь с коляской' },
  { id: 'cane', label: 'Использую трость' },
  { id: 'ramps', label: 'Нужны пандусы' },
  { id: 'avoid_stairs', label: 'Избегать лестниц' },
  { id: 'hearing', label: 'Проблемы со слухом' },
  { id: 'none', label: 'Нет ограничений' },
];

const tempoOptions: { id: Tempo; label: string }[] = [
  { id: 'slow', label: 'Медленно' },
  { id: 'medium', label: 'Средне' },
  { id: 'fast', label: 'Быстро' },
];

const durationOptions = Array.from({ length: 12 }, (_, i) => i + 1);

export function ProfileInterestsScreen() {
  const navigation = useNavigation();

  const interests = usePreferencesStore((s) => s.interests);
  const toggleInterest = usePreferencesStore((s) => s.toggleInterest);
  const accessibility = usePreferencesStore((s) => s.accessibility);
  const toggleAccessibility = usePreferencesStore((s) => s.toggleAccessibility);
  const tempo = usePreferencesStore((s) => s.tempo);
  const setTempo = usePreferencesStore((s) => s.setTempo);
  const budgetMinStore = usePreferencesStore((s) => s.budgetMin);
  const budgetMaxStore = usePreferencesStore((s) => s.budgetMax);
  const setBudget = usePreferencesStore((s) => s.setBudget);
  const durationMinStore = usePreferencesStore((s) => s.durationMinHours);
  const durationMaxStore = usePreferencesStore((s) => s.durationMaxHours);
  const setDuration = usePreferencesStore((s) => s.setDuration);
  const savePreferences = useSavePreferences();

  const [budgetMin, setBudgetMin] = useState(
    budgetMinStore !== null ? String(budgetMinStore) : '',
  );
  const [budgetMax, setBudgetMax] = useState(
    budgetMaxStore !== null ? String(budgetMaxStore) : '',
  );
  const [durationMin, setDurationMin] = useState<number | null>(
    durationMinStore,
  );
  const [durationMax, setDurationMax] = useState<number | null>(
    durationMaxStore,
  );
  const [durationPicker, setDurationPicker] = useState<'min' | 'max' | null>(
    null,
  );

  const budgetError = useMemo(() => {
    if (!budgetMin && !budgetMax) return null;
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    if (min !== null && Number.isNaN(min)) return 'Введите число';
    if (max !== null && Number.isNaN(max)) return 'Введите число';
    if (min !== null && max !== null && min > max) {
      return '«От» больше «до»';
    }
    return null;
  }, [budgetMin, budgetMax]);

  const durationError = useMemo(() => {
    if (durationMin !== null && durationMax !== null && durationMin > durationMax) {
      return '«От» больше «до»';
    }
    return null;
  }, [durationMin, durationMax]);

  const canSave = !budgetError && !durationError;

  const handleSave = async () => {
    if (!canSave) return;
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;
    setBudget(min, max);
    setDuration(durationMin, durationMax);
    await savePreferences.mutateAsync({ budget_level: toBudgetLevel(max) });
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader />

        <Text style={styles.h1}>Интересы</Text>
        <View style={styles.grid}>
          {interestOptions.map((item) => {
            const active = interests.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleInterest(item.id)}
                style={styles.tile}
              >
                <LinearGradient
                  colors={
                    active ? colors.gradientTileDeep : colors.gradientTile
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.tileBg}
                >
                  <Feather name={item.icon} size={24} color={colors.white} />
                  <Text style={styles.tileLabel}>{item.label}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.h1}>Особенности</Text>
        <View style={styles.list}>
          {accessibilityOptions.map((item) => {
            const checked = accessibility.includes(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggleAccessibility(item.id)}
                style={styles.checkRow}
              >
                <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                  {checked ? (
                    <Feather name="check" size={14} color={colors.textPrimary} />
                  ) : null}
                </View>
                <Text style={styles.checkLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.h1}>Предпочтения</Text>
        <Text style={styles.label}>Темп:</Text>
        <View style={styles.tempoList}>
          {tempoOptions.map((item) => {
            const active = tempo === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTempo(item.id)}
                style={styles.radioRow}
              >
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.radioLabel}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Бюджет:</Text>
        <View style={styles.rangeRow}>
          <Text style={styles.rangePrefix}>от</Text>
          <TextInput
            style={styles.rangeInput}
            value={budgetMin}
            onChangeText={setBudgetMin}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.rangeSuffix}>руб.</Text>
          <Text style={styles.rangePrefix}>до</Text>
          <TextInput
            style={styles.rangeInput}
            value={budgetMax}
            onChangeText={setBudgetMax}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.rangeSuffix}>руб.</Text>
        </View>
        {budgetError ? <Text style={styles.error}>{budgetError}</Text> : null}

        <Text style={[styles.label, { marginTop: 14 }]}>Время:</Text>
        <View style={styles.rangeRow}>
          <Text style={styles.rangePrefix}>от</Text>
          <Pressable
            style={styles.select}
            onPress={() => setDurationPicker('min')}
          >
            <Text style={styles.selectValue}>
              {durationMin !== null ? `${durationMin} ${hourWord(durationMin)}` : '—'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.rangePrefix}>до</Text>
          <Pressable
            style={styles.select}
            onPress={() => setDurationPicker('max')}
          >
            <Text style={styles.selectValue}>
              {durationMax !== null ? `${durationMax} ${hourWord(durationMax)}` : '—'}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.textPrimary} />
          </Pressable>
        </View>
        {durationError ? <Text style={styles.error}>{durationError}</Text> : null}
        {savePreferences.isError ? (
          <Text style={styles.error}>{extractApiError(savePreferences.error)}</Text>
        ) : null}

        <View style={styles.saveWrap}>
          <SaveButton
            onPress={handleSave}
            disabled={!canSave}
            loading={savePreferences.isPending}
          />
        </View>
      </ScrollView>

      <Modal
        visible={durationPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDurationPicker(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDurationPicker(null)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Выберите часы</Text>
            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
            >
              {durationOptions.map((hours) => (
                <Pressable
                  key={hours}
                  style={styles.modalItem}
                  onPress={() => {
                    if (durationPicker === 'min') setDurationMin(hours);
                    if (durationPicker === 'max') setDurationMax(hours);
                    setDurationPicker(null);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {hours} {hourWord(hours)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function hourWord(hours: number): string {
  const last = hours % 10;
  const mod = hours % 100;
  if (mod >= 11 && mod <= 14) return 'часов';
  if (last === 1) return 'часа';
  if (last >= 2 && last <= 4) return 'часа';
  return 'часов';
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  tile: {
    width: '47%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tileBg: {
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 86,
    justifyContent: 'center',
  },
  tileLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  list: {
    marginBottom: 10,
    gap: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: 'transparent',
  },
  checkLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  label: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  tempoList: {
    gap: 10,
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.textPrimary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textPrimary,
  },
  radioLabel: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rangePrefix: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  rangeSuffix: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  rangeInput: {
    width: 70,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.white,
    minWidth: 88,
  },
  selectValue: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  error: {
    marginTop: 4,
    fontSize: 12,
    color: colors.errorText,
  },
  saveWrap: {
    alignItems: 'center',
    marginTop: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlayDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 260,
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: 12,
    maxHeight: 320,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingBottom: 8,
  },
  modalList: {
    maxHeight: 260,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalItemText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
