import type { ReactNode } from 'react';

export const generateStaticParams =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    ? async () => (await import('@/lib/demo/static-params')).demoStaticParams.auctions()
    : undefined;

export default function AuctionDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
