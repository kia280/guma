// app/providers.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SharedElementTransition } from 'react-aria-components';
import { type ReactNode } from 'react';

import '@/lib/store';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      themes={['light', 'dark']}
    >
      <SharedElementTransition>{children}</SharedElementTransition>
    </NextThemesProvider>
  );
}
