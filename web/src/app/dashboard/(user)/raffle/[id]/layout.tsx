import type { ReactNode } from 'react';

export const generateStaticParams =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    ? async () => (await import('@/lib/demo/static-params')).demoStaticParams.raffles()
    : undefined;

export default function RaffleDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
