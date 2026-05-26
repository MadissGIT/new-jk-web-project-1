import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Tempo = 'slow' | 'medium' | 'fast';

export type InterestId =
  | 'art'
  | 'coffee'
  | 'history'
  | 'nature'
  | 'music'
  | 'relax';

export type AccessibilityId =
  | 'wheelchair'
  | 'cane'
  | 'ramps'
  | 'avoid_stairs'
  | 'hearing'
  | 'none';

export type PreferencesState = {
  _hasHydrated: boolean;
  completed: boolean;

  interests: InterestId[];
  accessibility: AccessibilityId[];
  tempo: Tempo | null;
  budgetMin: number | null;
  budgetMax: number | null;
  durationMinHours: number | null;
  durationMaxHours: number | null;

  setHydrated: (value: boolean) => void;
  toggleInterest: (id: InterestId) => void;
  toggleAccessibility: (id: AccessibilityId) => void;
  setTempo: (tempo: Tempo) => void;
  setBudget: (min: number | null, max: number | null) => void;
  setDuration: (min: number | null, max: number | null) => void;
  applyRemotePreferences: (
    value: Partial<
      Pick<
        PreferencesState,
        | 'interests'
        | 'accessibility'
        | 'tempo'
        | 'budgetMin'
        | 'budgetMax'
        | 'durationMinHours'
        | 'durationMaxHours'
      >
    >,
  ) => void;
  markCompleted: () => void;
  reset: () => void;
};

const initial = {
  completed: false,
  interests: [] as InterestId[],
  accessibility: [] as AccessibilityId[],
  tempo: null as Tempo | null,
  budgetMin: 0 as number | null,
  budgetMax: 12000 as number | null,
  durationMinHours: 1 as number | null,
  durationMaxHours: 12 as number | null,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      ...initial,

      setHydrated: (value) => set({ _hasHydrated: value }),

      toggleInterest: (id) => {
        const current = get().interests;
        set({
          interests: current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id],
        });
      },

      toggleAccessibility: (id) => {
        const current = get().accessibility;
        if (id === 'none') {
          set({ accessibility: current.includes('none') ? [] : ['none'] });
          return;
        }
        const withoutNone = current.filter((item) => item !== 'none');
        set({
          accessibility: withoutNone.includes(id)
            ? withoutNone.filter((item) => item !== id)
            : [...withoutNone, id],
        });
      },

      setTempo: (tempo) => set({ tempo }),
      setBudget: (min, max) => set({ budgetMin: min, budgetMax: max }),
      setDuration: (min, max) =>
        set({ durationMinHours: min, durationMaxHours: max }),
      applyRemotePreferences: (value) => set(value),

      markCompleted: () => set({ completed: true }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completed: state.completed,
        interests: state.interests,
        accessibility: state.accessibility,
        tempo: state.tempo,
        budgetMin: state.budgetMin,
        budgetMax: state.budgetMax,
        durationMinHours: state.durationMinHours,
        durationMaxHours: state.durationMaxHours,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export const selectOnboardingCompleted = (state: PreferencesState) =>
  state.completed;
