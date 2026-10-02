'use client';

import { Button, FieldError, Input, Label, Modal, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { apiClient } from '@/lib/guma';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { useWalletAction } from '../_hooks/useWalletAction';
import { PendingLabel, WalletActionModal } from './WalletActionModal';

type DepositModalProps = {
  guildId: string;
  balance: number;
  onCompleted: () => void;
};

export function DepositModal({ guildId, balance, onCompleted }: DepositModalProps) {
  const t = useTranslations('walletPage');
  const formatGold = useFormatGold();
  const state = useOverlayState();
  const action = useWalletAction('deposit', onCompleted);
  const [amount, setAmount] = React.useState('');
  const amountValue = parseGold(amount);
  const amountError = amount !== '' && !(amountValue > 0) ? t('amountMustBePositive') : null;

  const open = () => {
    action.reset();
    state.open();
  };

  const handleDeposit = () => {
    if (!(amountValue > 0)) return;
    return action.run(
      () => apiClient.deposit(guildId, amountValue),
      t('depositSuccessDetail', { amount: formatGold(amountValue) }),
      { onSuccess: () => setAmount('') },
    );
  };

  return (
    <>
      <Button variant="tertiary" className="w-full sm:w-auto" onPress={open}>
        <Icon icon="solar:arrow-down-linear" width={16} />
        {t('deposit')}
      </Button>
      <WalletActionModal state={state} action={action} successTitle={t('depositSuccess')}>
        <Modal.Header>
          <Modal.Heading>{t('depositMoney')}</Modal.Heading>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <TextField validationBehavior="aria" isInvalid={Boolean(amountError)}>
            <Label>{t('amountLabel')}</Label>
            <Input
              autoFocus
              placeholder="0.00"
              type="number"
              min={0}
              step={GOLD_STEP}
              inputMode="decimal"
              value={amount}
              variant="secondary"
              onChange={e => setAmount(e.target.value)}
            />
            <FieldError>{amountError}</FieldError>
          </TextField>
          <p className="type-caption text-hint px-1">
            {t('currentBalanceLabel')} {formatGold(balance)}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary" isDisabled={action.isPending}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            onPress={handleDeposit}
            isPending={action.isPending}
            isDisabled={!(amountValue > 0)}
          >
            {({ isPending }) => <PendingLabel isPending={isPending}>{t('deposit')}</PendingLabel>}
          </Button>
        </Modal.Footer>
      </WalletActionModal>
    </>
  );
}
