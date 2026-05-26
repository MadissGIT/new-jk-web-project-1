import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  surname: string;
  patronymic: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'user' | 'employee' | 'admin';
  status?: 'active' | 'blocked';
  date_of_birth: string;
  created_at: string;
};

type AuthState = {
  _hasHydrated: boolean;
  hasSeenWelcome: boolean;
  token: string | null;
  user: AuthUser | null;
  setHydrated: (value: boolean) => void;
  setHasSeenWelcome: (value: boolean) => void;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      _hasHydrated: false,
      hasSeenWelcome: false,
      token: null,
      user: null,
      setHydrated: (value) => set({ _hasHydrated: value }),
      setHasSeenWelcome: (value) => set({ hasSeenWelcome: value }),
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        hasSeenWelcome: state.hasSeenWelcome,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export const selectIsAuthenticated = (state: AuthState) => Boolean(state.token);
