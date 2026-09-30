'use client';

import { Card, Chip, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { DEMO_ROLE_ICONS } from '@/components/demo/role-icons';
import { saveDemoRole } from '@/lib/demo/role';
import { DEV_MOCK_ROLES, type DevMockRole } from '@/lib/dev-mock';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import { roleChipColor } from '@/lib/permissions';
import { safeReturnPath } from '@/lib/safe-return-path';

export default function DemoLogin() {
  return (
    <React.Suspense>
      <DemoRolePicker />
    </React.Suspense>
  );
}

function DemoRolePicker() {
  const t = useTranslations('demo');
  const roles = useTranslations('adminPage.roles');
  const summaries = useTranslations('adminRolesPage.roleSummaries');
  const searchParams = useSearchParams();
  const returnUrl = safeReturnPath(searchParams.get('return'), '/dashboard');

  const signIn = (role: DevMockRole) => {
    saveDemoRole(role);
    window.location.assign(returnUrl);
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border border-transparent shadow-edge bg-surface py-6">
        <Card.Header className="flex flex-col items-center gap-2 px-4 pt-2 pb-0 text-center">
          <Image src="/assets/logo/sunbaby-96x96.png" alt="Guma" width={60} height={60} preload />
          <div className="flex items-center gap-2 pt-2">
            <h1 className="type-title text-foreground text-balance">{t('loginTitle')}</h1>
            <Chip size="sm" color="accent" variant="soft">
              {t('badge')}
            </Chip>
          </div>
          <Card.Description className="type-prose text-subtle">{t('loginDescription')}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3 px-2 pt-4 pb-0 sm:px-4">
          <nav aria-label={t('rolesLabel')}>
            <ul className="flex flex-col gap-0.5">
              {DEV_MOCK_ROLES.map(role => (
                <li key={role}>
                  <button
                    type="button"
                    aria-label={t('signInAs', { role: roles(role) })}
                    aria-describedby={`demo-role-${role}`}
                    onClick={() => signIn(role)}
                    className={cn('flex w-full items-center gap-3 text-left', LIST_ROW_CLASS)}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default text-subtle">
                      <Icon icon={DEMO_ROLE_ICONS[role]} width={20} aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Chip size="sm" variant="secondary" color={roleChipColor(role)} className="self-start">
                        {roles(role)}
                      </Chip>
                      <span id={`demo-role-${role}`} className="type-caption text-subtle">
                        {summaries(role)}
                      </span>
                    </span>
                    <Icon icon="solar:alt-arrow-right-linear" width={18} className="shrink-0 text-hint" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <p className="border-t border-divider px-2 pt-4 text-center type-caption text-hint">{t('dataNote')}</p>
        </Card.Content>
      </Card>
    </main>
  );
}
