import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PoeFiltersState = {
  category: string | null;
  wheelchairOnly: boolean;
  avoidStairs: boolean;
  radiusMeters: number | null;
  setCategory: (value: string | null) => void;
  setWheelchairOnly: (value: boolean) => void;
  setAvoidStairs: (value: boolean) => void;
  setRadiusMeters: (value: number | null) => void;
  resetFilters: () => void;
};

const initialFilters = {
  category: null as string | null,
  wheelchairOnly: false,
  avoidStairs: false,
  radiusMeters: null as number | null,
};

export const usePoeFiltersStore = create<PoeFiltersState>((set) => ({
  ...initialFilters,
  setCategory: (category) => set({ category }),
  setWheelchairOnly: (wheelchairOnly) => set({ wheelchairOnly }),
  setAvoidStairs: (avoidStairs) => set({ avoidStairs }),
  setRadiusMeters: (radiusMeters) => set({ radiusMeters }),
  resetFilters: () => set(initialFilters),
}));

type PoeFavoritesState = {
  _hasHydrated: boolean;
  favouriteIds: string[];
  setHydrated: (value: boolean) => void;
  setFavouriteIds: (ids: string[]) => void;
  toggleFavourite: (id: string) => void;
};

export const usePoeFavouritesStore = create<PoeFavoritesState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      favouriteIds: [],
      setHydrated: (value) => set({ _hasHydrated: value }),
      setFavouriteIds: (ids) => set({ favouriteIds: Array.from(new Set(ids)) }),
      toggleFavourite: (id) => {
        const current = get().favouriteIds;
        set({
          favouriteIds: current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id],
        });
      },
    }),
    {
      name: 'poe-favourites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ favouriteIds: state.favouriteIds }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
