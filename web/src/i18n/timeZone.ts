export const TIME_ZONE_COOKIE = 'GUMA_TIME_ZONE';

export const TIME_ZONE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const DEFAULT_TIME_ZONE = 'UTC';

const TIME_ZONE_PATTERN = /^[A-Za-z0-9_+\-/]{1,64}$/;

export function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !TIME_ZONE_PATTERN.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string | undefined {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isTimeZone(timeZone) ? timeZone : undefined;
  } catch {
    return undefined;
  }
}
