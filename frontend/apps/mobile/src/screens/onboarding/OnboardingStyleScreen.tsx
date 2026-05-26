import { Feather } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { RootStackParamList } from '../../navigation/RootNavigator';
import { OnboardingLayout } from '../../features/onboarding/components/OnboardingLayout';
import {
  type Tempo,
  usePreferencesStore,
} from '../../entities/preferences/preferencesStore';
import { toBudgetLevel } from '../../entities/preferences/api';
import { useSavePreferences } from '../../entities/preferences/hooks';
import { extractApiError } from '../../shared/api/http';
import { colors } from '../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingStyle'>;

const tempoOptions: { id: Tempo; label: string }[] = [
  { id: 'slow', label: 'Медленно' },
  { id: 'medium', label: 'Средне' },
  { id: 'fast', label: 'Быстро' },
];

const durationOptions = [1, 2, 4, 8, 12, 24];

function formatHours(hours: number | null): string {
  if (hours == null) return '—';
  const mod10 = hours % 10;
  const mod100 = hours % 100;
  if (mod10 === 1 && mod100 !== 11) return `${hours} час`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return `${hours} часа`;
  return `${hours} часов`;
}

export function OnboardingStyleScreen({ navigation }: Props) {
  const tempo = usePreferencesStore((s) => s.tempo);
  const budgetMin = usePreferencesStore((s) => s.budgetMin);
  const budgetMax = usePreferencesStore((s) => s.budgetMax);
  const durationMin = usePreferencesStore((s) => s.durationMinHours);
  const durationMax = usePreferencesStore((s) => s.durationMaxHours);

  const setTempo = usePreferencesStore((s) => s.setTempo);
  const setBudget = usePreferencesStore((s) => s.setBudget);
  const setDuration = usePreferencesStore((s) => s.setDuration);
  const markCompleted = usePreferencesStore((s) => s.markCompleted);
  const savePreferences = useSavePreferences();

  const [budgetMinInput, setBudgetMinInput] = useState(
    budgetMin != null ? String(budgetMin) : '',
  );
  const [budgetMaxInput, setBudgetMaxInput] = useState(
    budgetMax != null ? String(budgetMax) : '',
  );
  const [pickerOpen, setPickerOpen] = useState<null | 'min' | 'max'>(null);

  const budgetError = useMemo(() => {
    const min = Number(budgetMinInput);
    const max = Number(budgetMaxInput);
    if (
      budgetMinInput &&
      (Number.isNaN(min) || min < 0 || min > 1_000_000)
    ) {
      return 'Некорректное значение';
    }
    if (
      budgetMaxInput &&
      (Number.isNaN(max) || max < 0 || max > 1_000_000)
    ) {
      return 'Некорректное значение';
    }
    if (budgetMinInput && budgetMaxInput && min > max) {
      return 'Некорректное значение';
    }
    return null;
  }, [budgetMinInput, budgetMaxInput]);

  const durationError = useMemo(() => {
    if (durationMin != null && durationMax != null && durationMin > durationMax) {
      return 'Некорректное значение';
    }
    return null;
  }, [durationMin, durationMax]);

  const canSubmit = !budgetError && !durationError;

  const onBudgetChange = (which: 'min' | 'max', raw: string) => {
    const cleaned = raw.replace(/[^\d-]/g, '');
    if (which === 'min') {
      setBudgetMinInput(cleaned);
    } else {
      setBudgetMaxInput(cleaned);
    }
  };

  const persistBudget = () => {
    const min = budgetMinInput === '' ? null : Number(budgetMinInput);
    const max = budgetMaxInput === '' ? null : Number(budgetMaxInput);
    setBudget(Number.isNaN(min as number) ? null : min, Number.isNaN(max as number) ? null : max);
  };

  const finish = async () => {
    if (!canSubmit) return;
    persistBudget();
    markCompleted();
    const max = budgetMaxInput === '' ? null : Number(budgetMaxInput);
    await savePreferences.mutateAsync({
      pace: tempo ?? 'medium',
      budget_level: toBudgetLevel(Number.isNaN(max as number) ? null : max),
    });
    navigation.reset({ index: 0, routes: [{ name: 'OnboardingComplete' }] });
  };

  const skipAll = () => {
    markCompleted();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };

  const pickDuration = (value: number) => {
    if (pickerOpen === 'min') {
      setDuration(value, durationMax);
    } else if (pickerOpen === 'max') {
      setDuration(durationMin, value);
    }
    setPickerOpen(null);
  };

  return (
    <OnboardingLayout
      title="Как вы любите исследовать город?"
      step={{ current: 3, total: 3 }}
      primaryLabel="Завершить"
      onPrimary={finish}
      primaryDisabled={!canSubmit || savePreferences.isPending}
      onSkip={skipAll}
    >
      <Text style={styles.sectionLabel}>Темп:</Text>
      <View style={styles.tempoList}>
        {tempoOptions.map((item) => {
          const isChecked = tempo === item.id;
          return (
            <Pressable
              key={item.id}
              style={styles.radioRow}
              onPress={() => setTempo(item.id)}
            >
              <View style={[styles.radio, isChecked && styles.radioChecked]}>
                {isChecked ? (
                  <View style={styles.radioDotBg}>
                    <Feather name="check" size={14} color={colors.textPrimary} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.radioLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Бюджет:</Text>
      <View style={styles.rangeRow}>
        <Text style={styles.rangePrefix}>от</Text>
        <TextInput
          style={[styles.numberInput, budgetError && styles.inputError]}
          value={budgetMinInput}
          onChangeText={(text) => onBudgetChange('min', text)}
          onBlur={persistBudget}
          keyboardType="numeric"
          maxLength={7}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.rangeSuffix}>руб.</Text>
        <Text style={styles.rangePrefix}>до</Text>
        <TextInput
          style={[styles.numberInput, budgetError && styles.inputError]}
          value={budgetMaxInput}
          onChangeText={(text) => onBudgetChange('max', text)}
          onBlur={persistBudget}
          keyboardType="numeric"
          maxLength={7}
          placeholder="12 000"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.rangeSuffix}>руб.</Text>
      </View>
      {budgetError ? <Text style={styles.errorText}>{budgetError}</Text> : null}

      <Text style={[styles.sectionLabel, styles.sectionSpacer]}>Время:</Text>
      <View style={styles.rangeRow}>
        <Text style={styles.rangePrefix}>от</Text>
        <Pressable
          style={[styles.select, durationError && styles.inputError]}
          onPress={() => setPickerOpen('min')}
        >
          <Text style={styles.selectText}>{formatHours(durationMin)}</Text>
          <Feather name="chevron-down" size={16} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.rangePrefix}>до</Text>
        <Pressable
          style={[styles.select, durationError && styles.inputError]}
          onPress={() => setPickerOpen('max')}
        >
          <Text style={styles.selectText}>{formatHours(durationMax)}</Text>
          <Feather name="chevron-down" size={16} color={colors.textPrimary} />
        </Pressable>
      </View>
      {durationError ? (
        <Text style={styles.errorText}>{durationError}</Text>
      ) : null}
      {savePreferences.isError ? (
        <Text style={styles.errorText}>{extractApiError(savePreferences.error)}</Text>
      ) : null}

      <Modal
        transparent
        visible={pickerOpen !== null}
        animationType="fade"
        onRequestClose={() => setPickerOpen(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(null)}
        >
          <View style={styles.modalContent}>
            {durationOptions.map((value) => (
              <Pressable
                key={value}
                style={styles.modalItem}
                onPress={() => pickDuration(value)}
              >
                <Text style={styles.modalItemText}>{formatHours(value)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  sectionSpacer: {
    marginTop: 18,
  },
  tempoList: {
    gap: 10,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioChecked: {
    borderColor: colors.textPrimary,
  },
  radioDotBg: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  rangePrefix: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rangeSuffix: {
    fontSize: 14,
    color: colors.textMuted,
  },
  numberInput: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minWidth: 72,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#C45C5C',
  },
  select: {
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 96,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectText: {
    fontSize: 14,
    color: colors.textPrimary,
    marginRight: 8,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#C45C5C',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 8,
    width: 200,
    maxHeight: 320,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalItemText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});
