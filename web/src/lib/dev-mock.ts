import { env } from '@/lib/env';

export const DEV_MOCK_COOKIE = 'guma_dev_mock';

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function isDevMockEnabled(): boolean {
  if (!env.devTools || typeof document === 'undefined') {
    return false;
  }
  return document.cookie.split('; ').some((c) => c === `${DEV_MOCK_COOKIE}=1`);
}

export function setDevMockEnabled(enabled: boolean): void {
  const maxAge = enabled ? COOKIE_MAX_AGE_SECONDS : 0;
  document.cookie = `${DEV_MOCK_COOKIE}=${enabled ? '1' : ''}; path=/; max-age=${maxAge}; samesite=lax`;
}
