import { http } from '../api/http';
import type { AuthUser } from '../../entities/auth/authStore';

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  surname: string;
  patronymic: string | null;
  phone?: string | null;
  email: string;
  password: string;
  date_of_birth: string;
};

export type UpdateMePayload = {
  name?: string | null;
  surname?: string | null;
  patronymic?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};

export async function loginRequest(payload: LoginPayload): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set('username', payload.email.trim());
  body.set('password', payload.password);
  const { data } = await http.post<TokenResponse>('/login/access-token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function registerRequest(payload: RegisterPayload): Promise<AuthUser> {
  const { data } = await http.post<AuthUser>('/login/register', payload);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await http.get<AuthUser>('/users/me');
  return data;
}

export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  const { data } = await http.put<AuthUser>('/users/me', payload);
  return data;
}
