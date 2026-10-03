'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { GuildContribution } from '@/types/guild-bank';
import { isBalanceNeutralContribution, isInflowContribution, isSettledContribution } from '../_lib/contributions';

export function ContributionAmount({
  entry,
  align,
}: {
  entry: Pick<GuildContribution, 'type' | 'status'> & { amount: number };
  align: 'start' | 'end';
}) {
  const t = useTranslations('guildBankPage');
  const formatGold = useFormatGold();
  const alignClass =
    align === 'end' ? 'flex-row-reverse flex-wrap items-baseline gap-x-1.5' : 'flex-col items-start';

  if (entry.status === 'pending') {
    return (
      <span className={`flex ${alignClass}`}>
        <span className="type-body font-medium tabular-nums text-subtle">{formatGold(entry.amount)}</span>
        <span className="type-caption text-hint">{t('amountPending')}</span>
      </span>
    );
  }
  if (!isSettledContribution(entry.status)) {
    return (
      <span className="type-body font-medium tabular-nums text-hint line-through">
        {formatGold(entry.amount)}
      </span>
    );
  }
  if (isBalanceNeutralContribution(entry.type)) {
    return <span className="type-body font-medium tabular-nums text-subtle">{formatGold(entry.amount)}</span>;
  }
  return (
    <span
      className={`type-body font-medium tabular-nums ${isInflowContribution(entry.type) ? 'text-success' : 'text-foreground'}`}
    >
      {isInflowContribution(entry.type) ? '+' : '-'}{formatGold(entry.amount)}
    </span>
  );
}
