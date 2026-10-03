'use client';

import { Button, Card, Separator, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import { useUserName } from '@/hooks/useUserName';
import type { GuildOverview } from '../_hooks/useGuildOverview';
import { useIntlLocale } from '../_hooks/useIntlLocale';
import { formatRelative, getActivityColor, getActivityIcon } from '../_lib/format';

type RecentActivityCardProps = Pick<GuildOverview, 'recentActivity' | 'activityStatus' | 'retryActivity'>;

export function RecentActivityCard({ recentActivity, activityStatus, retryActivity }: RecentActivityCardProps) {
  const t = useTranslations('adminPage');
  const userName = useUserName();
  const intlLocale = useIntlLocale();

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:history-linear" width={18} className="text-hint" aria-hidden />
          <h2 className="type-subheading text-foreground">{t('recentActivity')}</h2>
        </div>
      </Card.Header>
      <Card.Content className="pt-0">
        {activityStatus === 'loading' ? (
          <div className="flex items-center justify-center py-10">
            <Spinner aria-label={t('loadingActivity')} />
          </div>
        ) : activityStatus === 'error' ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-3 py-10">
            <Icon icon="solar:danger-circle-linear" width={32} className="text-danger" aria-hidden />
            <p className="type-body text-subtle">{t('activityLoadError')}</p>
            <Button size="sm" variant="secondary" onPress={retryActivity}>
              <Icon icon="solar:restart-linear" width={16} aria-hidden />
              {t('retry')}
            </Button>
          </div>
        ) : recentActivity.length === 0 ? (
          <EmptyContent icon="solar:history-linear" title={t('noActivity')} description={t('noActivityHint')} />
        ) : (
          <ul>
            {recentActivity.map((item, i) => (
              <li key={item.id}>
                <div className="flex items-start gap-3 py-3">
                  <div className={`mt-0.5 shrink-0 ${getActivityColor(item.actionType)}`}>
                    <Icon icon={getActivityIcon(item.actionType)} width={18} aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="type-body text-foreground">
                      <span className="font-medium">{userName(item.actor)}</span>{' '}
                      <span className="text-subtle">{item.action}</span>
                    </p>
                    <p className="type-caption text-hint mt-0.5">
                      <time dateTime={item.timestamp}>{formatRelative(new Date(item.timestamp), intlLocale)}</time>
                    </p>
                  </div>
                </div>
                {i < recentActivity.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}
