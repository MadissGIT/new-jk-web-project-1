import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { RouteGeneratedPublic } from './types';

type RouteHistoryState = {
  routes: RouteGeneratedPublic[];
  addRoute: (route: RouteGeneratedPublic) => void;
  updateRoute: (route: RouteGeneratedPublic) => void;
  removeRoutes: (routeIds: string[]) => void;
  clearRoutes: () => void;
};

export const useRouteHistoryStore = create<RouteHistoryState>()(
  persist(
    (set) => ({
      routes: [],
      addRoute: (route) =>
        set((state) => {
          const deduped = state.routes.filter((item) => item.id !== route.id);
          return { routes: [{ ...route, status: 'saved' as const }, ...deduped].slice(0, 10) };
        }),
      updateRoute: (route) =>
        set((state) => ({
          routes: state.routes.map((item) => (item.id === route.id ? route : item)),
        })),
      removeRoutes: (routeIds) =>
        set((state) => ({
          routes: state.routes.filter((item) => !routeIds.includes(item.id)),
        })),
      clearRoutes: () => set({ routes: [] }),
    }),
    {
      name: 'route-history',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ routes: state.routes }),
    },
  ),
);
