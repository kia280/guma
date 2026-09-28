'use client';

import { NextIntlClientProvider, useLocale, useTimeZone } from 'next-intl';
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { TIME_ZONE_COOKIE, TIME_ZONE_COOKIE_MAX_AGE_SECONDS, getBrowserTimeZone } from './timeZone';

const subscribe = () => () => {};

export function BrowserTimeZoneProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const requestTimeZone = useTimeZone();
  const timeZone = useSyncExternalStore(
    subscribe,
    () => getBrowserTimeZone() ?? requestTimeZone,
    () => requestTimeZone,
  );

  useEffect(() => {
    if (timeZone === requestTimeZone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${timeZone}; path=/; max-age=${TIME_ZONE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
  }, [timeZone, requestTimeZone]);

  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
