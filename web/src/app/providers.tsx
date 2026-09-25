// app/providers.tsx
'use client';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { SharedElementTransition } from 'react-aria-components';
import { RouterProvider } from '@heroui/react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { type ReactNode } from 'react';

import { env } from '@/lib/env';
import '@/lib/store';

const DevTools = env.devTools ? dynamic(() => import('@/components/dev/DevTools'), { ssr: false }) : null;

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      themes={['light', 'dark']}
    >
      <RouterProvider navigate={router.push}>
        <SharedElementTransition>{children}</SharedElementTransition>
        {DevTools && <DevTools />}
      </RouterProvider>
    </NextThemesProvider>
  );
}
