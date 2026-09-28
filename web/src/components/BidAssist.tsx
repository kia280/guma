'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { roundGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { useUserStore } from '@/lib/store';
import type { AuctionItem } from '@/types/auction';

const QUICK_STEPS = [1, 5] as const;

export const minimumBidFor = (item: AuctionItem) =>
  roundGold(item.currentBidder ? item.currentBid + item.minBidIncrement : Math.max(item.startingBid, item.minBidIncrement));

export const bidCost = (item: AuctionItem, amount: number, userId: string | undefined) => {
  const isRaisingOwnBid = !!userId && item.currentBidder?.id === userId;
  const cost = Number.isFinite(amount) ? roundGold(isRaisingOwnBid ? amount - item.currentBid : amount) : 0;
  return { cost, isRaisingOwnBid };
};

type BidAssistProps = {
  item: AuctionItem;
  amount: number;
  minimumBid: number;
  balance: number;
  isBalanceLoaded?: boolean;
  onChange: (amount: number) => void;
};

export function BidAssist({ item, amount, minimumBid, balance, isBalanceLoaded = true, onChange }: BidAssistProps) {
  const t = useTranslations('bidAssist');
  const formatGold = useFormatGold();
  const userId = useUserStore(s => s.user?.id);
  const { cost, isRaisingOwnBid } = bidCost(item, amount, userId);
  const base = Number.isFinite(amount) && amount >= minimumBid ? amount : minimumBid;
  const remaining = roundGold(balance - cost);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('quickPicks')}>
        {QUICK_STEPS.map(step => {
          const increment = roundGold(item.minBidIncrement * step);
          return (
            <Button
              key={step}
              size="sm"
              variant="tertiary"
              isDisabled={increment <= 0}
              aria-label={t('addIncrementLabel', { amount: formatGold(increment) })}
              onPress={() => onChange(roundGold(base + increment))}
            >
              {step === 1 ? t('addIncrement', { amount: formatGold(increment) }) : t('addMultiple', { step, amount: formatGold(increment) })}
            </Button>
          );
        })}
      </div>
      {isBalanceLoaded && Number.isFinite(amount) && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary px-3 py-2" aria-live="polite">
          <div className="flex justify-between type-body">
            <span className="text-subtle">{t('balanceAfterBid')}</span>
            <span className={`font-medium tabular-nums ${remaining < 0 ? 'text-danger' : 'text-foreground'}`}>
              {formatGold(remaining)}
            </span>
          </div>
          {isRaisingOwnBid && (
            <p className="type-caption text-hint">{t('raiseOwnBid', { amount: formatGold(cost) })}</p>
          )}
        </div>
      )}
    </div>
  );
}
