'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;
const DAY_S = 24 * HOUR_S;

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / DAY_S),
    hours: Math.floor((total % DAY_S) / HOUR_S),
    minutes: Math.floor((total % HOUR_S) / MINUTE_S),
    seconds: total % MINUTE_S,
  };
}

export function useCountdownFormatter() {
  const t = useTranslations('countdown');

  return useCallback(
    (remainingMs: number) => {
      const { days, hours, minutes, seconds } = splitDuration(remainingMs);
      if (days > 0) return t('days', { days, hours });
      if (hours > 0) return t('hours', { hours, minutes });
      if (minutes > 0) return t('minutes', { minutes });
      return t('seconds', { seconds });
    },
    [t]
  );
}
