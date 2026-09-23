// app/providers.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SharedElementTransition } from 'react-aria-components';
import dynamic from 'next/dynamic';
import { type ReactNode } from 'react';

import { env } from '@/lib/env';
import '@/lib/store';

const DevTools = env.devTools ? dynamic(() => import('@/components/dev/DevTools'), { ssr: false }) : null;

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      themes={['light', 'dark']}
    >
      <SharedElementTransition>{children}</SharedElementTransition>
      {DevTools && <DevTools />}
    </NextThemesProvider>
  );
}
