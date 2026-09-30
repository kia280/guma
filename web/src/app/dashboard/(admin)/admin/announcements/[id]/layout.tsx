import type { ReactNode } from 'react';

export const generateStaticParams =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
    ? async () => (await import('@/lib/demo/static-params')).demoStaticParams.announcements()
    : undefined;

export default function AnnouncementEditorLayout({ children }: { children: ReactNode }) {
  return children;
}
