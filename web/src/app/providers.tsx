// app/providers.tsx
'use client';
import { RouterProvider } from '@heroui/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';
import { SharedElementTransition } from 'react-aria-components';
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
