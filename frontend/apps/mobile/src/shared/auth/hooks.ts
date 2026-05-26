import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { fetchMe, loginRequest, registerRequest, updateMe } from './api';
import type { LoginPayload, RegisterPayload, UpdateMePayload } from './api';
import { useAuthStore } from '../../entities/auth/authStore';

function isSessionCheckAuthError(error: unknown) {
  if (!isAxiosError(error)) return false;
  return error.response?.status === 401 || error.response?.status === 403;
}

export function useMe() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const user = await fetchMe();
        setUser(user);
        return user;
      } catch (error) {
        if (isSessionCheckAuthError(error)) {
          logout();
          queryClient.removeQueries({ queryKey: ['auth', 'me'] });
        }
        throw error;
      }
    },
    enabled: Boolean(token),
    retry: (failureCount, error) => {
      if (isSessionCheckAuthError(error)) return false;
      return failureCount < 2;
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => loginRequest(payload),
    onSuccess: async (data) => {
      setToken(data.access_token);
      const user = await queryClient.fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: fetchMe,
      });
      setUser(user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => registerRequest(payload),
  });
}

export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateMePayload) => updateMe(payload),
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(['auth', 'me'], user);
    },
  });
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return () => {
    logout();
    queryClient.clear();
  };
}
