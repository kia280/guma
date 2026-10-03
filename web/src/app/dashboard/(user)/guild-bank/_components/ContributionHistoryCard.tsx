'use client';

import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import type { LoadState } from '@/hooks/useLoadState';
import type { GuildContribution } from '@/types/guild-bank';
import { ContributionList } from './ContributionList';

type ContributionHistoryCardProps = {
  contributions: GuildContribution[];
  loadState: LoadState;
  onRetry: () => void;
};

export function ContributionHistoryCard({ contributions, loadState, onRetry }: ContributionHistoryCardProps) {
  const t = useTranslations('guildBankPage');
  const highlightedRequestId = useSearchParams().get('request');

  const isHighlighted = (entry: GuildContribution) =>
    Boolean(highlightedRequestId) &&
    (entry.id === `r-${highlightedRequestId}` || entry.id === `i-${highlightedRequestId}`);

  React.useEffect(() => {
    if (!highlightedRequestId || loadState !== 'ready') return;
    const rows = document.querySelectorAll<HTMLElement>('[data-highlighted="true"]');
    Array.from(rows).find(row => row.offsetParent !== null)?.scrollIntoView({ block: 'center' });
  }, [highlightedRequestId, loadState, contributions]);

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
          <Icon className="text-subtle" icon="solar:history-line-duotone" width={20} />
        </div>
        <div className="flex flex-col">
          <p className="type-subheading text-foreground">{t('activityHistory')}</p>
        </div>
      </Card.Header>
      <Card.Content className="pt-0">
        <AsyncContent state={loadState} onRetry={onRetry} skeleton={<ListSkeleton rows={5} />}>
          {contributions.length === 0 ? (
            <EmptyContent icon="solar:history-line-duotone" title={t('noActivity')} description={t('noActivityHint')} />
          ) : (
            <ContributionList contributions={contributions} isHighlighted={isHighlighted} />
          )}
        </AsyncContent>
      </Card.Content>
    </Card>
  );
}
