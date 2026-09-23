'use client';

import { TanStackDevtools } from '@tanstack/react-devtools';
import { useTranslations } from 'next-intl';

import { DevAuthPanel } from './DevAuthPanel';

export default function DevTools() {
  const t = useTranslations('devTools');

  return (
    <TanStackDevtools
      config={{ position: 'bottom-left' }}
      plugins={[
        {
          id: 'guma-dev-auth',
          name: t('authTab'),
          defaultOpen: true,
          render: <DevAuthPanel />,
        },
      ]}
    />
  );
}
