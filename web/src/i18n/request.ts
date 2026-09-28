import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from './locales';
import { DEFAULT_TIME_ZONE, TIME_ZONE_COOKIE, isTimeZone } from './timeZone';

export default getRequestConfig(async () => {
  const store = await cookies();
  const stored = store.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(stored) ? stored : DEFAULT_LOCALE;
  const storedTimeZone = store.get(TIME_ZONE_COOKIE)?.value;

  return {
    locale,
    timeZone: isTimeZone(storedTimeZone) ? storedTimeZone : DEFAULT_TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});
