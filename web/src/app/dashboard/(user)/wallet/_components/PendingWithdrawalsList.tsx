'use client';

import { Button, Chip } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { apiClient } from '@/lib/guma';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { WithdrawalRequest } from '@/types/wallet';
import { PendingLabel } from './WalletActionModal';

type PendingWithdrawalsListProps = {
  guildId: string;
  requests: WithdrawalRequest[];
  onSettled: () => void;
};

export function PendingWithdrawalsList({ guildId, requests, onSettled }: PendingWithdrawalsListProps) {
  const t = useTranslations('walletPage');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const notify = useToast();
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  const cancel = (request: WithdrawalRequest) => {
    setCancellingId(request.id);
    return apiClient
      .cancelWithdrawalRequest(guildId, request.id)
      .then(() => notify.success(t('withdrawalRequestCancelled', { amount: formatGold(request.amount) })))
      .catch(() => notify.error(t('withdrawalRequestCancelFailed')))
      .finally(() => {
        setCancellingId(null);
        onSettled();
      });
  };

  if (requests.length === 0) return null;

  return (
    <section aria-labelledby="pending-withdrawals-heading" className="flex flex-col gap-2">
      <h3 id="pending-withdrawals-heading" className="type-label text-soft">
        {t('pendingWithdrawals')}
      </h3>
      <ul className="flex flex-col gap-2">
        {requests.map(request => (
          <li
            key={request.id}
            className="flex flex-col gap-3 rounded-lg bg-surface-secondary px-3 py-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2 type-body">
                <p className="font-medium tabular-nums text-foreground">{formatGold(request.amount)}</p>
                <Chip size="sm" variant="secondary" color="warning">
                  {t('pendingReview')}
                </Chip>
              </div>
              <p className="type-caption text-hint">
                {t('withdrawalRequestedOn', {
                  date: format.dateTime(new Date(request.createdAt), { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
              {request.note && <p className="type-caption text-subtle break-words">{request.note}</p>}
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="self-end sm:self-center"
              aria-label={t('cancelWithdrawalLabel', { amount: formatGold(request.amount) })}
              isPending={cancellingId === request.id}
              isDisabled={cancellingId !== null && cancellingId !== request.id}
              onPress={() => cancel(request)}
            >
              {({ isPending }) => <PendingLabel isPending={isPending}>{t('cancelWithdrawal')}</PendingLabel>}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
