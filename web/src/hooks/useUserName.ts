'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

export function useUserName() {
  const t = useTranslations('userName');
  return useCallback((name: string | null | undefined) => name?.trim() || t('unknown'), [t]);
}
