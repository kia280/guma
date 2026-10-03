'use client';

import { Chip, Table, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { contributionStatusColor } from '@/lib/status-colors';
import type { GuildContribution } from '@/types/guild-bank';
import { getContributionIcon } from '../_lib/contributions';
import { ContributionAmount } from './ContributionAmount';

type ContributionListProps = {
  contributions: GuildContribution[];
  isHighlighted: (entry: GuildContribution) => boolean;
};

export function ContributionList({ contributions, isHighlighted }: ContributionListProps) {
  const t = useTranslations('guildBankPage');
  const userName = useUserName();
  const format = useIntlFormatter();

  const getContributionLabel = (type: GuildContribution['type']) => {
    switch (type) {
      case 'contribute':
        return t('typeContribute');
      case 'request':
        return t('typeRequest');
      case 'item_donate':
        return t('typeItemDonate');
      case 'item_distribute':
        return t('typeItemDistribute');
      case 'roll_call_loot':
        return t('typeRollCallLoot');
      case 'auction_proceeds':
        return t('typeAuctionProceeds');
      case 'raffle_revenue':
        return t('typeRaffleRevenue');
      case 'roll_call_gold_payout':
        return t('typeRollCallGoldPayout');
      case 'roll_call_gold_retracted':
        return t('typeRollCallGoldRetracted');
      case 'roll_call_gold_kept':
        return t('typeRollCallGoldKept');
      case 'admin_transfer':
        return t('typeAdminTransfer');
    }
  };

  const typeIcon = (entry: GuildContribution, className: string) => (
    <div className={className}>
      <Icon className="text-subtle" icon={getContributionIcon(entry.type)} width={16} />
    </div>
  );

  const date = (entry: GuildContribution) => format.dateTime(new Date(entry.date), { dateStyle: 'medium' });

  return (
    <>
      <div className="hidden md:block">
        <Table variant="secondary">
          <Table.ScrollContainer>
            <Table.Content aria-label={t('activityTable')} className="min-w-[700px]">
              <Table.Header>
                <Table.Column isRowHeader>{t('activity')}</Table.Column>
                <Table.Column>{t('member')}</Table.Column>
                <Table.Column>{t('amountItem')}</Table.Column>
                <Table.Column>{t('date')}</Table.Column>
                <Table.Column>{t('status')}</Table.Column>
              </Table.Header>
              <Table.Body>
                {contributions.map(entry => (
                  <Table.Row
                    key={entry.id}
                    data-highlighted={isHighlighted(entry) || undefined}
                    className={cn(isHighlighted(entry) && 'bg-accent/10')}
                  >
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        {typeIcon(entry, 'flex h-8 w-8 items-center justify-center rounded-lg bg-default')}
                        <div className="flex flex-col">
                          <p className="type-body font-medium text-foreground">{getContributionLabel(entry.type)}</p>
                          {entry.note && entry.href ? (
                            <Link
                              href={entry.href}
                              className="rounded type-caption text-hint hover:text-accent truncate max-w-[180px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            >
                              {entry.note}
                            </Link>
                          ) : entry.note && (
                            <p className="type-caption text-hint truncate max-w-[180px]">{entry.note}</p>
                          )}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex items-center gap-2">
                        <UserAvatar name={userName(entry.member)} src={entry.memberAvatar} className="size-6" />
                        <p className="type-body text-foreground">{userName(entry.member)}</p>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col items-start">
                        {entry.amount !== undefined && (
                          <ContributionAmount entry={{ ...entry, amount: entry.amount }} align="start" />
                        )}
                        {entry.itemName && (
                          <span className="type-body text-subtle line-clamp-2 max-w-[220px]">{entry.itemName}</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <p className="type-body text-subtle">{date(entry)}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip color={contributionStatusColor[entry.status]} size="sm" variant="tertiary">
                        {t(entry.status)}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <div className="block md:hidden divide-y divide-divider">
        {contributions.map(entry => (
          <div
            key={entry.id}
            data-highlighted={isHighlighted(entry) || undefined}
            className={cn('py-3 first:pt-0 last:pb-0', isHighlighted(entry) && 'bg-accent/10 rounded-lg px-2')}
          >
            <div className="flex items-start gap-3">
              {typeIcon(entry, 'flex h-8 w-8 items-center justify-center rounded-lg bg-default shrink-0')}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="type-body font-medium text-foreground truncate shrink-0 max-w-[60%]">
                    {getContributionLabel(entry.type)}
                  </p>
                  <div className="flex flex-col items-end min-w-0 text-right">
                    {entry.amount !== undefined && (
                      <ContributionAmount entry={{ ...entry, amount: entry.amount }} align="end" />
                    )}
                    {entry.itemName && (
                      <p className="type-body text-subtle line-clamp-2 wrap-break-word">{entry.itemName}</p>
                    )}
                  </div>
                </div>
                {entry.note && entry.href ? (
                  <Link
                    href={entry.href}
                    className="self-start rounded type-caption text-hint hover:text-accent line-clamp-2 max-w-full wrap-break-word focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {entry.note}
                  </Link>
                ) : entry.note && (
                  <p className="type-caption text-hint line-clamp-2 wrap-break-word">{entry.note}</p>
                )}
                <div className="flex items-center justify-between gap-2 mt-1 type-caption">
                  <p className="text-hint truncate">
                    {userName(entry.member)}
                    <span aria-hidden="true"> · </span>
                    {date(entry)}
                  </p>
                  <Chip className="shrink-0" size="sm" color={contributionStatusColor[entry.status]} variant="secondary">
                    {t(entry.status)}
                  </Chip>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
