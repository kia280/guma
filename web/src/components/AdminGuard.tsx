'use client';

import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useGuildPermissions } from '@/lib/permissions';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('adminGuard');
  const router = useRouter();
  const { can, isResolved } = useGuildPermissions();

  if (!isResolved) return null;
  if (can('accessAdmin')) return children;

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning/10">
        <Icon icon="solar:shield-cross-linear" width={24} className="text-warning" aria-hidden />
      </div>
      <h2 className="type-subheading text-foreground">{t('title')}</h2>
      <p className="type-body text-subtle max-w-md">{t('description')}</p>
      <Button variant="secondary" onPress={() => router.push('/dashboard')}>
        <Icon icon="solar:home-2-linear" width={16} aria-hidden />
        {t('backToDashboard')}
      </Button>
    </div>
  );
}
