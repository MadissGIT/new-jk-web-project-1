import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RouteGeneratedPublic } from './types';

type ActiveRouteState = {
  route: RouteGeneratedPublic | null;
  setRoute: (route: RouteGeneratedPublic | null) => void;
};

export const useActiveRouteStore = create<ActiveRouteState>()(
  persist(
    (set) => ({
      route: null,
      setRoute: (route) => set({ route }),
    }),
    {
      name: 'active-route',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ route: state.route }),
    },
  ),
);
