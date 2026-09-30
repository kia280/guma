// app/providers.tsx
'use client';
import { RouterProvider, Toast } from '@heroui/react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ReactNode } from 'react';
import { SharedElementTransition } from 'react-aria-components';
import { useMediaQuery } from 'usehooks-ts';
import '@/lib/store';

const DevTools =
  process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && process.env.NEXT_PUBLIC_DEV_TOOLS === 'true'
    ? dynamic(() => import('@/components/dev/DevTools'), { ssr: false })
    : null;

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isPhone = useMediaQuery('(max-width: 639px)', { initializeWithValue: false });

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      themes={['light', 'dark']}
    >
      <RouterProvider navigate={router.push}>
        <SharedElementTransition>{children}</SharedElementTransition>
        <Toast.Provider placement={isPhone ? 'top' : 'bottom end'} />
        {DevTools && <DevTools />}
      </RouterProvider>
    </NextThemesProvider>
  );
}
