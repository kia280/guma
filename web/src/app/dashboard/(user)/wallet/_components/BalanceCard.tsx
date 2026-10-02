'use client';

import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncValue } from '@/components/AsyncContent';
import { BalanceTrendChart } from '@/components/BalanceTrendChart';
import type { useBalanceTrend } from '@/hooks/useBalanceTrend';
import type { LoadState } from '@/hooks/useLoadState';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { Wallet } from '@/types/wallet';

type BalanceCardProps = {
  wallet: Wallet | null;
  walletState: LoadState;
  balanceTrend: ReturnType<typeof useBalanceTrend>;
  actions: React.ReactNode;
  pendingWithdrawals: React.ReactNode;
};

export function BalanceCard({ wallet, walletState, balanceTrend, actions, pendingWithdrawals }: BalanceCardProps) {
  const t = useTranslations('walletPage');
  const formatGold = useFormatGold();
  const balance = wallet?.balance ?? 0;
  const heldForWithdrawals = wallet?.pendingWithdrawals ?? 0;
  const lockedInBids = wallet?.lockedInBids ?? 0;
  const lockedBids = wallet?.lockedBids ?? [];

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <Icon className="text-accent" icon="solar:wallet-money-bold-duotone" width={20} />
        </div>
        <div className="flex flex-col">
          <p className="type-subheading text-foreground">{t('balanceAndBackpack')}</p>
        </div>
      </Card.Header>
      <Card.Content className="pt-0 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="type-caption text-hint">{t('availableBalance')}</p>
            <AsyncValue state={walletState}>
              <p className="type-display text-foreground">{formatGold(balance)}</p>
              {heldForWithdrawals > 0 && (
                <p className="mt-2 type-caption text-subtle">
                  {t('heldForWithdrawals', { amount: formatGold(heldForWithdrawals) })}
                </p>
              )}
              {lockedBids.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  <p className="type-caption text-subtle">
                    {t('lockedInBids', { amount: formatGold(lockedInBids), count: lockedBids.length })}
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-label={t('lockedBidsLabel')}>
                    {lockedBids.map(bid => (
                      <li key={bid.auctionId}>
                        <Link
                          href={`/dashboard/auction/${bid.auctionId}`}
                          className="inline-flex items-center gap-1 rounded-full bg-default px-2 py-0.5 type-caption text-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          <Icon icon="solar:sledgehammer-linear" width={12} aria-hidden />
                          <span className="max-w-[160px] truncate">{bid.itemName || t('unnamedAuction')}</span>
                          <span className="tabular-nums">{formatGold(bid.amount)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </AsyncValue>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">{actions}</div>
        </div>

        {pendingWithdrawals}

        <div>
          <BalanceTrendChart
            points={balanceTrend.points}
            status={balanceTrend.status}
            onRetry={balanceTrend.retry}
            height={200}
          />
        </div>
      </Card.Content>
    </Card>
  );
}
