import { isAxiosError } from 'axios';

import type { ApiErrorBody } from './types';

export function getErrorStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/** True when the request never got a response (offline, wrong IP, API not running). */
export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

/** Turns any error into one plain sentence to show under a form. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (!isAxiosError(error)) return fallback;

  if (!error.response) {
    return error.code === 'ECONNABORTED'
      ? 'The server took too long to respond. Try again.'
      : "Can't reach the server. Check your connection and try again.";
  }

  const { status, data } = error.response;
  const body = data as Partial<ApiErrorBody> | undefined;
  const raw = Array.isArray(body?.message) ? body.message[0] : body?.message;

  // The rate limiter's default message ("ThrottlerException: …") isn't user-friendly.
  if (status === 429 && (!raw || raw.startsWith('ThrottlerException'))) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (typeof raw === 'string' && raw.length > 0) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  if (status >= 500) return 'Something went wrong on our side. Try again.';
  return fallback;
}
