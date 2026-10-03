import { HTML_LANG, isLocale } from '@/i18n/locales';

export const STATUSES = ['online', 'offline', 'banned'] as const;
export const ROLES = ['owner', 'admin', 'moderator', 'member'] as const;
export const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, moderator: 2, member: 3 };

export const timeValue = (value?: string) => {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

export const formatRelative = (date: Date, intlLocale: string) => {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
};

export const getActivityIcon = (type: string) => {
  switch (type) {
    case 'auction':
      return 'solar:sledgehammer-linear';
    case 'rollCall':
      return 'solar:clipboard-check-linear';
    case 'raffle':
      return 'solar:ticket-linear';
    case 'join':
      return 'solar:user-plus-linear';
    default:
      return 'solar:info-circle-linear';
  }
};

export const getActivityColor = (type: string) => {
  switch (type) {
    case 'auction':
      return 'text-warning';
    case 'rollCall':
      return 'text-success';
    case 'raffle':
      return 'text-accent';
    case 'join':
      return 'text-subtle';
    default:
      return 'text-hint';
  }
};

export const toIntlLocale = (locale: string) => (isLocale(locale) ? HTML_LANG[locale] : locale);
