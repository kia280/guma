'use client';

import { Button, FieldError, Input, Label, Modal, TextArea, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { useWalletAction } from '../_hooks/useWalletAction';
import { PendingLabel, WalletActionModal } from './WalletActionModal';
import { WarningNote } from './WarningNote';

const WITHDRAWAL_NOTE_MAX_LENGTH = 200;

type WithdrawModalProps = {
  guildId: string;
  balance: number;
  onCompleted: () => void;
  onFailed: () => void;
};

export function WithdrawModal({ guildId, balance, onCompleted, onFailed }: WithdrawModalProps) {
  const t = useTranslations('walletPage');
  const formatGold = useFormatGold();
  const notify = useToast();
  const state = useOverlayState();
  const action = useWalletAction('withdraw', onCompleted);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const amountValue = parseGold(amount);
  const exceedsBalance = amountValue > balance;
  const amountError =
    amount === ''
      ? null
      : !(amountValue > 0)
        ? t('amountMustBePositive')
        : exceedsBalance
          ? t('insufficientBalance')
          : null;
  const canWithdraw = amountValue > 0 && !exceedsBalance;

  const open = () => {
    action.reset();
    state.open();
  };

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    return action.run(
      () => apiClient.withdraw(guildId, { amount: amountValue, note: note.trim() || undefined }),
      t('withdrawSuccessDetail', { amount: formatGold(amountValue) }),
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
        },
        onError: err => {
          onFailed();
          notify.error(t(apiErrorCode(err) === GrpcCode.FailedPrecondition ? 'insufficientBalance' : 'withdrawFailed'));
        },
      },
    );
  };

  return (
    <>
      <Button variant="secondary" className="w-full sm:w-auto" onPress={open}>
        <Icon icon="solar:arrow-up-linear" width={16} />
        {t('withdraw')}
      </Button>
      <WalletActionModal state={state} action={action} successTitle={t('withdrawSuccess')}>
        <Modal.Header>
          <Modal.Heading>{t('withdrawMoney')}</Modal.Heading>
        </Modal.Header>
        <Modal.Body className="flex flex-col gap-3">
          <TextField validationBehavior="aria" isInvalid={Boolean(amountError)}>
            <Label>{t('amountLabel')}</Label>
            <Input
              autoFocus
              placeholder="0.00"
              type="number"
              min={0}
              max={balance}
              step={GOLD_STEP}
              inputMode="decimal"
              value={amount}
              variant="secondary"
              onChange={e => setAmount(e.target.value)}
            />
            <FieldError>{amountError}</FieldError>
          </TextField>
          <p className="type-caption text-hint px-1">
            {t('available')} {formatGold(balance)}
          </p>
          <TextField>
            <Label>{t('withdrawNoteLabel')}</Label>
            <TextArea
              variant="secondary"
              rows={2}
              maxLength={WITHDRAWAL_NOTE_MAX_LENGTH}
              placeholder={t('withdrawNotePlaceholder')}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </TextField>
          <WarningNote>{t('withdrawNote')}</WarningNote>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary" isDisabled={action.isPending}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onPress={handleWithdraw} isPending={action.isPending} isDisabled={!canWithdraw}>
            {({ isPending }) => <PendingLabel isPending={isPending}>{t('submitWithdrawal')}</PendingLabel>}
          </Button>
        </Modal.Footer>
      </WalletActionModal>
    </>
  );
}
