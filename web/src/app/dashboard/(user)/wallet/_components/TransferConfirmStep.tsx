'use client';

import { Alert, Button, Modal } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import type { MemberOption } from '@/components/MemberComboBox';
import { UserAvatar } from '@/components/UserAvatar';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { PendingLabel } from './WalletActionModal';

type TransferConfirmStepProps = {
  recipient: MemberOption | undefined;
  amount: number;
  balance: number;
  error: string | null;
  exceedsBalance: boolean;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
};

export function TransferConfirmStep({
  recipient,
  amount,
  balance,
  error,
  exceedsBalance,
  isPending,
  onBack,
  onConfirm,
}: TransferConfirmStepProps) {
  const t = useTranslations('walletPage');
  const formatGold = useFormatGold();
  return (
    <>
      <Modal.Header>
        <Modal.Heading>{t('confirmTransfer')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3">
        <p className="type-body text-soft">{t('confirmTransferHint')}</p>
        <div className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3">
          <UserAvatar name={recipient?.name ?? ''} src={recipient?.avatar} size="md" />
          <div className="flex min-w-0 flex-col">
            <p className="type-caption text-hint">{t('recipient')}</p>
            <p className="type-body font-medium text-foreground truncate">{recipient?.name}</p>
          </div>
        </div>
        <dl className="flex flex-col gap-2 rounded-lg bg-surface-secondary p-3 type-body">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-subtle">{t('amountLabel')}</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatGold(amount)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-subtle">{t('balanceAfterTransfer')}</dt>
            <dd className="tabular-nums text-foreground">{formatGold(Math.max(0, balance - amount))}</dd>
          </div>
        </dl>
        {(error || exceedsBalance) && (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{error ?? t('transferInsufficient')}</Alert.Title>
            </Alert.Content>
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button autoFocus variant="secondary" isDisabled={isPending} onPress={onBack}>
          {t('back')}
        </Button>
        <Button variant="primary" onPress={onConfirm} isPending={isPending} isDisabled={exceedsBalance}>
          {({ isPending: isButtonPending }) => (
            <PendingLabel isPending={isButtonPending}>{t('confirmTransferAction')}</PendingLabel>
          )}
        </Button>
      </Modal.Footer>
    </>
  );
}
