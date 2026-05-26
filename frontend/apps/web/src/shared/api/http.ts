import axios, { AxiosError } from 'axios'

import { useAuthStore } from '../auth/authStore'

export type ApiErrorPayload = {
  code?: string
  message?: string
  detail?: string | Array<{ msg: string }>
  details?: unknown
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      const { token, logout } = useAuthStore.getState()
      if (token) {
        logout()
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.replace(`/login?redirect=${redirect}`)
        }
      }
    }
    return Promise.reject(error)
  },
)

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    const data = error.response?.data
    if (data) {
      if (typeof data.detail === 'string') return data.detail
      if (Array.isArray(data.detail) && data.detail.length) return data.detail[0].msg
      if (data.message) return data.message
    }
    return error.message
  }
  return 'Неизвестная ошибка'
}
