export const LOCALES = ['zht', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zht';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const LOCALE_LABELS: Record<Locale, string> = {
  zht: '繁體中文',
  en: 'English',
};

export const HTML_LANG: Record<Locale, string> = {
  zht: 'zh-Hant',
  en: 'en',
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}
