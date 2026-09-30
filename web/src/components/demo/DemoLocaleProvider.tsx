'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import React from 'react';
import { DEFAULT_LOCALE, HTML_LANG, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/locales';
import en from '../../../messages/en.json';
import zht from '../../../messages/zht.json';

const MESSAGES: Record<Locale, AbstractIntlMessages> = { en, zht };

const subscribe = () => () => {};

const readLocale = (): Locale => {
  const prefix = `${LOCALE_COOKIE}=`;
  const stored = document.cookie.split('; ').find(cookie => cookie.startsWith(prefix))?.slice(prefix.length);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
};

export default function DemoLocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = React.useSyncExternalStore(subscribe, readLocale, () => DEFAULT_LOCALE);

  React.useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);

  return (
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
