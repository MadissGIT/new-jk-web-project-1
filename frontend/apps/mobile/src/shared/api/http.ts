import axios, { AxiosError, isAxiosError } from 'axios';

import { useAuthStore } from '../../entities/auth/authStore';
import { rootNavigationRef } from '../../navigation/navigationRef';

export type ApiErrorPayload = {
  code?: string;
  message?: string;
  detail?: string | { msg: string }[];
  details?: unknown;
};

export const http = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    // Только 401 = сессия недействительна. 403 часто значит «нет права на ресурс»,
    // а не «нужен новый токен» — иначе любой 403 сбрасывает auth и локальный профиль.
    if (error.response?.status === 401) {
      const { token, logout } = useAuthStore.getState();
      if (token) {
        logout();
        if (rootNavigationRef.isReady()) {
          rootNavigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
        }
      }
    }
    return Promise.reject(error);
  },
);

export function extractApiError(error: unknown): string {
  if (isAxiosError<ApiErrorPayload>(error)) {
    const data = error.response?.data;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
      if (Array.isArray(data.detail) && data.detail.length) return data.detail[0].msg;
      if (data.message) return data.message;
    }
    return error.message;
  }
  return 'Неизвестная ошибка';
}
