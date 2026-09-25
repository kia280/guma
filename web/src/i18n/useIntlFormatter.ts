'use client';

import { useMemo } from 'react';
import { createFormatter, useLocale, useTimeZone } from 'next-intl';

import { HTML_LANG, isLocale } from './locales';

export function useIntlFormatter() {
  const locale = useLocale();
  const timeZone = useTimeZone();

  return useMemo(
    () => createFormatter({ locale: isLocale(locale) ? HTML_LANG[locale] : locale, timeZone }),
    [locale, timeZone]
  );
}
