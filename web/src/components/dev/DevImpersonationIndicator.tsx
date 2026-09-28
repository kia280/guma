'use client';

import { Button, Chip, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { devLogout, getDevSession, type DevUser } from '@/lib/dev-auth';
import { isDevMockEnabled } from '@/lib/dev-mock';
import { env } from '@/lib/env';

const AFTER_LOGOUT_PATH = '/dashboard';

export function DevImpersonationIndicator() {
  const t = useTranslations('devTools');
  const [user, setUser] = useState<DevUser | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (env.useMock || isDevMockEnabled()) return;
    let cancelled = false;
    getDevSession()
      .then(session => {
        if (!cancelled) setUser(session);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const name = user.displayName || user.username || user.email;
  const leave = async () => {
    setIsLeaving(true);
    try {
      await devLogout();
      window.location.assign(AFTER_LOGOUT_PATH);
    } catch {
      setIsLeaving(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-1 type-body">
      <Chip size="sm" color="warning" variant="soft" className="hidden max-w-56 sm:flex">
        <Icon icon="solar:incognito-linear" width={14} aria-hidden />
        <span className="truncate">{t('actingAs', { name })}</span>
      </Chip>
      <Tooltip delay={300}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="size-11 min-w-11 text-warning sm:size-7 sm:min-w-7"
          aria-label={t('backToMyAccount', { name })}
          isPending={isLeaving}
          onPress={() => void leave()}
        >
          <Icon icon="solar:logout-3-linear" width={18} aria-hidden />
        </Button>
        <Tooltip.Content>{t('backToMyAccount', { name })}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}
