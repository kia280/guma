'use client';

import { TanStackDevtools } from '@tanstack/react-devtools';
import { useTranslations } from 'next-intl';

import { DevAuthPanel } from './DevAuthPanel';
import { DevPalettePanel, useApplyDevPalette } from './DevPalettePanel';

export default function DevTools() {
  const t = useTranslations('devTools');
  useApplyDevPalette();

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
        {
          id: 'guma-dev-palette',
          name: t('paletteTab'),
          render: <DevPalettePanel />,
        },
      ]}
    />
  );
}
