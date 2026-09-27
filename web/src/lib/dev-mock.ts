import { env } from '@/lib/env';
import type { GuildRole } from '@/lib/permissions';

export const DEV_MOCK_COOKIE = 'guma_dev_mock';
export const DEV_MOCK_ROLE_COOKIE = 'guma_dev_mock_role';

export const DEV_MOCK_ROLES = ['owner', 'admin', 'moderator', 'member'] as const satisfies readonly GuildRole[];
export type DevMockRole = (typeof DEV_MOCK_ROLES)[number];

const DEFAULT_DEV_MOCK_ROLE: DevMockRole = 'owner';
const DEV_TOOLS_DISABLED_MOCK_ROLE: DevMockRole = 'member';

const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  return document.cookie.split('; ').find((c) => c.startsWith(prefix))?.slice(prefix.length);
}

const isDevMockRole = (value: string | undefined): value is DevMockRole =>
  (DEV_MOCK_ROLES as readonly string[]).includes(value ?? '');

export function isDevMockEnabled(): boolean {
  if (!env.devTools || typeof document === 'undefined') {
    return false;
  }
  return readCookie(DEV_MOCK_COOKIE) === '1';
}

export function setDevMockEnabled(enabled: boolean): void {
  const maxAge = enabled ? COOKIE_MAX_AGE_SECONDS : 0;
  document.cookie = `${DEV_MOCK_COOKIE}=${enabled ? '1' : ''}; path=/; max-age=${maxAge}; samesite=lax`;
}

export function getDevMockRole(): DevMockRole {
  if (!env.devTools) {
    return DEV_TOOLS_DISABLED_MOCK_ROLE;
  }
  if (typeof document === 'undefined') {
    return DEFAULT_DEV_MOCK_ROLE;
  }
  const value = readCookie(DEV_MOCK_ROLE_COOKIE);
  return isDevMockRole(value) ? value : DEFAULT_DEV_MOCK_ROLE;
}

export function setDevMockRole(role: DevMockRole): void {
  document.cookie = `${DEV_MOCK_ROLE_COOKIE}=${role}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}
