'use client';

import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { readDemoRole } from '@/lib/demo/role';

export default function DemoGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasRole] = React.useState(() => readDemoRole() !== null);

  React.useEffect(() => {
    if (!hasRole) router.replace(`/login?return=${encodeURIComponent(pathname)}`);
  }, [hasRole, pathname, router]);

  return hasRole ? children : null;
}
