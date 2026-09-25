'use client';

import { useCallback, useMemo } from 'react';
import { useIntlFormatter, useIntlLocale } from '@/i18n/useIntlFormatter';
import { GOLD_FORMAT_OPTIONS } from './money';

export type FormatGold = (amount: number) => string;

export function useFormatGold(): FormatGold {
  const format = useIntlFormatter();

  return useCallback((amount: number) => format.number(amount, GOLD_FORMAT_OPTIONS), [format]);
}

export function useFormatGoldAxisTick(): FormatGold {
  const locale = useIntlLocale();
  const compact = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [locale]
  );

  return useCallback((amount: number) => compact.format(amount), [compact]);
}

export const formatPrize = (prize: string, amount: number | undefined, formatGold: FormatGold): string =>
  prize || (amount === undefined ? '' : formatGold(amount));
