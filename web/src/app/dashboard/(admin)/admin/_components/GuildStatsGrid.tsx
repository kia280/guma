'use client';

import { Button, Card, Skeleton } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { GuildOverview } from '../_hooks/useGuildOverview';
import { useIntlLocale } from '../_hooks/useIntlLocale';

type GuildStatsGridProps = Pick<GuildOverview, 'guildStats' | 'statsStatus' | 'retryStats'>;

export function GuildStatsGrid({ guildStats, statsStatus, retryStats }: GuildStatsGridProps) {
  const t = useTranslations('adminPage');
  const formatGold = useFormatGold();
  const intlLocale = useIntlLocale();
  const formatCount = (value: number) => new Intl.NumberFormat(intlLocale).format(value);

  if (statsStatus === 'error') {
    return (
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Content className="p-4">
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:danger-circle-linear" width={18} className="text-danger" aria-hidden />
              <p className="type-body text-subtle">{t('statsLoadError')}</p>
            </div>
            <Button size="sm" variant="secondary" onPress={retryStats}>
              <Icon icon="solar:restart-linear" width={16} aria-hidden />
              {t('retry')}
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  const statCards = [
    {
      key: 'members',
      label: t('totalMembers'),
      value: guildStats ? formatCount(guildStats.memberCount) : '',
      icon: 'solar:users-group-rounded-linear',
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      key: 'balance',
      label: t('guildBalance'),
      value: guildStats ? formatGold(guildStats.bankBalance) : '',
      icon: 'solar:wallet-money-linear',
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      key: 'events',
      label: t('activeEvents'),
      value: guildStats ? formatCount(guildStats.activeEventCount) : '',
      icon: 'solar:calendar-linear',
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      key: 'items',
      label: t('totalItems'),
      value: guildStats ? formatCount(guildStats.bankItemCount) : '',
      icon: 'solar:backpack-linear',
      color: 'text-subtle',
      bg: 'bg-default',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy={statsStatus === 'loading'}>
      {statsStatus === 'loading' && <span className="sr-only">{t('loadingStats')}</span>}
      {statCards.map(stat => (
        <Card key={stat.key} className="border border-transparent shadow-edge bg-surface">
          <Card.Content>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <div className={`${stat.bg} p-2 rounded-lg shrink-0`}>
                <Icon icon={stat.icon} width={18} className={stat.color} aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="type-caption text-hint">{stat.label}</p>
                {statsStatus === 'loading' ? (
                  <Skeleton className="mt-1 h-7 w-20 rounded-lg" />
                ) : (
                  <p className="type-heading sm:type-title tabular-nums text-foreground wrap-anywhere">{stat.value}</p>
                )}
              </div>
            </div>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
