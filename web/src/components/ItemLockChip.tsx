'use client';

import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ItemLock } from '@/types/item';

const LOCK_META: Record<ItemLock['type'], { icon: string; href: (id: string) => string }> = {
  auction: { icon: 'solar:sledgehammer-linear', href: id => `/dashboard/auction/${id}` },
  lottery: { icon: 'solar:ticket-linear', href: id => `/dashboard/lottery/${id}` },
};

export function ItemLockChip({ lock }: { lock: ItemLock }) {
  const t = useTranslations('itemLock');
  const meta = LOCK_META[lock.type];
  return (
    <Link
      href={meta.href(lock.id)}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 type-caption text-warning hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Icon icon={meta.icon} width={12} aria-hidden />
      <span>{t(lock.type)}</span>
    </Link>
  );
}
