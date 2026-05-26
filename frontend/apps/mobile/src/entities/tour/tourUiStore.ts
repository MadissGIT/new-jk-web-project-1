import { create } from 'zustand';

import type { AccessibilityId, InterestId } from '../preferences/preferencesStore';

export type TourInterestFilter = Extract<
  InterestId,
  'art' | 'coffee' | 'history' | 'nature' | 'music'
> | 'walk';

type TourFiltersState = {
  priceMin: number | null;
  priceMax: number | null;
  durationMinHours: number | null;
  durationMaxHours: number | null;
  interests: TourInterestFilter[];
  accessibility: AccessibilityId[];
  radiusMeters: number | null;
  setPrice: (min: number | null, max: number | null) => void;
  setDuration: (min: number | null, max: number | null) => void;
  toggleInterest: (id: TourInterestFilter) => void;
  toggleAccessibility: (id: AccessibilityId) => void;
  setRadiusMeters: (value: number | null) => void;
  resetFilters: () => void;
};

const initialFilters = {
  priceMin: null as number | null,
  priceMax: null as number | null,
  durationMinHours: null as number | null,
  durationMaxHours: null as number | null,
  interests: [] as TourInterestFilter[],
  accessibility: [] as AccessibilityId[],
  radiusMeters: null as number | null,
};

export const useTourFiltersStore = create<TourFiltersState>((set, get) => ({
  ...initialFilters,
  setPrice: (priceMin, priceMax) => set({ priceMin, priceMax }),
  setDuration: (durationMinHours, durationMaxHours) =>
    set({ durationMinHours, durationMaxHours }),
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
  setRadiusMeters: (radiusMeters) => set({ radiusMeters }),
  resetFilters: () => set(initialFilters),
}));
