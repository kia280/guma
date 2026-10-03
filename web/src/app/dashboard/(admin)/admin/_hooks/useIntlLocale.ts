'use client';

import { useLocale } from 'next-intl';
import { toIntlLocale } from '../_lib/format';

export function useIntlLocale() {
  return toIntlLocale(useLocale());
}
