import { AxiosHeaders, create, isAxiosError, type InternalAxiosRequestConfig } from 'axios';

import { SESSION_EXPIRED, useSession } from '@/store/session';
import type { TokenPair } from './types';

const baseURL = process.env.EXPO_PUBLIC_API_URL;

if (!baseURL) {
  console.warn(
    'EXPO_PUBLIC_API_URL is not set. Copy apps/mobile/.env.example to .env and restart Expo.',
  );
}

export const api = create({
  baseURL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Bare instance with no interceptors, used only for /auth/refresh so it can't loop.
const refreshClient = create({ baseURL, timeout: 15_000 });

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// ---------- Attach the access token ----------
api.interceptors.request.use((config) => {
  const { accessToken } = useSession.getState();
  if (accessToken && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// ---------- Refresh once on 401, then retry ----------

// Parallel requests that all get a 401 share this single refresh call.
let refreshInFlight: Promise<string> | null = null;

class RefreshRejectedError extends Error {}

async function refreshAccessToken(): Promise<string> {
  const { refreshToken } = useSession.getState();
  if (!refreshToken) throw new RefreshRejectedError('No refresh token');

  try {
    const { data } = await refreshClient.post<TokenPair>('/auth/refresh', { refreshToken });
    await useSession.getState().setTokens(data);
    return data.accessToken;
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    // 4xx (except 429) means the refresh token is invalid, expired or reused: log out.
    // Network errors, 429 and 5xx keep the session so the user isn't logged out while offline.
    if (status && status >= 400 && status < 500 && status !== 429) {
      await useSession.getState().signOut(SESSION_EXPIRED);
      throw new RefreshRejectedError('Refresh token rejected');
    }
    throw error;
  }
}

function bearerOf(config: InternalAxiosRequestConfig): string | undefined {
  const value = AxiosHeaders.from(config.headers).get('Authorization');
  return typeof value === 'string' ? value.replace(/^Bearer /, '') : undefined;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    const isAuthRoute = original?.url?.startsWith('/auth/');

    if (error.response?.status !== 401 || !original || original._retried || isAuthRoute) {
      throw error;
    }
    original._retried = true;

    let token: string;
    const current = useSession.getState().accessToken;
    const sent = bearerOf(original);

    if (current && sent && current !== sent) {
      // Another request already refreshed while this one was in flight.
      token = current;
    } else {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      try {
        token = await refreshInFlight;
      } catch (refreshError) {
        // Logged out: surface the original 401. Otherwise surface the refresh's network error.
        throw refreshError instanceof RefreshRejectedError ? error : refreshError;
      }
    }

    original.headers.set('Authorization', `Bearer ${token}`);
    return api(original);
  },
);
