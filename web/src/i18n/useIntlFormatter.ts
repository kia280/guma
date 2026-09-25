'use client';

import { useMemo } from 'react';
import { createFormatter, useLocale, useTimeZone } from 'next-intl';

import { HTML_LANG, isLocale } from './locales';

export function useIntlLocale() {
  const locale = useLocale();
  return isLocale(locale) ? HTML_LANG[locale] : locale;
}

export function useIntlFormatter() {
  const locale = useIntlLocale();
  const timeZone = useTimeZone();

  return useMemo(() => createFormatter({ locale, timeZone }), [locale, timeZone]);
}
