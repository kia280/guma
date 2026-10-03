'use client';

import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncValue } from '@/components/AsyncContent';
import { useCurrentGuildId } from '@/lib/current-guild';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { ContributeModal } from './_components/ContributeModal';
import { ContributionHistoryCard } from './_components/ContributionHistoryCard';
import { FundRequestModal } from './_components/FundRequestModal';
import { ItemStorageCard } from './_components/ItemStorageCard';
import { useGuildBankData } from './_hooks/useGuildBankData';

export default function GuildBankPage() {
  const t = useTranslations('guildBankPage');
  const formatGold = useFormatGold();
  const guildId = useCurrentGuildId();
  const data = useGuildBankData(guildId);

  return (
    <div className="space-y-5">
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
            <Icon className="text-warning" icon="solar:safe-2-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('treasury')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <AsyncValue state={data.bankState}>
                <p className="type-display text-foreground">{formatGold(data.bank?.balance ?? 0)}</p>
              </AsyncValue>
              <p className="type-caption text-hint mt-0.5">{t('guildGold')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <ContributeModal guildId={guildId} onContributed={data.refetchBank} />
              <FundRequestModal guildId={guildId} bank={data.bank} onRequested={data.refetchBank} />
            </div>
          </div>
        </Card.Content>
      </Card>

      <ItemStorageCard
        guildId={guildId}
        items={data.items}
        loadState={data.itemsState}
        onRetry={data.reload}
        onChanged={data.refetchBank}
      />

      <ContributionHistoryCard
        contributions={data.contributions}
        loadState={data.contributionsState}
        onRetry={data.reload}
      />
    </div>
  );
}
