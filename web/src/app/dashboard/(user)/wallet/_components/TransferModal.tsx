'use client';

import { Button, FieldError, Input, Label, Modal, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { MemberComboBox, type MemberOption } from '@/components/MemberComboBox';
import { useUserName } from '@/hooks/useUserName';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { isGuildRole } from '@/lib/permissions';
import { useUserStore } from '@/lib/store';
import type { MockUser } from '@/types/user';
import { useTransferForm } from '../_hooks/useTransferForm';
import { useWalletAction } from '../_hooks/useWalletAction';
import { TransferConfirmStep } from './TransferConfirmStep';
import { WalletActionModal } from './WalletActionModal';

type TransferModalProps = {
  guildId: string;
  balance: number;
  members: MockUser[];
  onCompleted: () => void;
  onFailed: () => void;
};

export function TransferModal({ guildId, balance, members, onCompleted, onFailed }: TransferModalProps) {
  const t = useTranslations('walletPage');
  const roleLabels = useTranslations('adminPage.roles');
  const userName = useUserName();
  const formatGold = useFormatGold();
  const currentUserId = useUserStore(state => state.user?.id);
  const state = useOverlayState();
  const action = useWalletAction('transfer', onCompleted);
  const [form, dispatch] = useTransferForm();

  const recipientOptions = React.useMemo<MemberOption[]>(
    () =>
      members
        .filter(user => user.id !== currentUserId)
        .map(user => ({
          id: user.id,
          name: userName(user.username),
          avatar: user.avatar,
          description: isGuildRole(user.role) ? roleLabels(user.role) : undefined,
        })),
    [members, currentUserId, userName, roleLabels],
  );

  const amountValue = parseGold(form.amount);
  const exceedsBalance = amountValue > balance;
  const amountError = !(amountValue > 0)
    ? t('amountMustBePositive')
    : exceedsBalance
      ? t('insufficientBalance')
      : null;
  const recipientError = form.recipient ? null : t('recipientRequired');
  const showAmountError = Boolean(amountError) && (form.showErrors || form.amount !== '');
  const showRecipientError = Boolean(recipientError) && form.showErrors;
  const recipientOption = recipientOptions.find(option => option.id === form.recipient);

  const open = () => {
    dispatch({ type: 'opened' });
    action.reset();
    state.open();
  };

  const review = (trigger: Element) => {
    if (amountError || recipientError) {
      dispatch({ type: 'invalidSubmitted' });
      focusFirstInvalidField(trigger);
      return;
    }
    dispatch({ type: 'reviewed' });
  };

  const confirm = () => {
    if (amountError || recipientError) return;
    const amount = amountValue;
    const recipientId = form.recipient;
    const recipient = userName(members.find(user => user.id === recipientId)?.username);
    dispatch({ type: 'submitted' });
    return action.run(
      () => apiClient.transfer(guildId, { recipientId, amount }),
      t('transferSuccessDetail', { amount: formatGold(amount), recipient }),
      {
        onSuccess: () => dispatch({ type: 'succeeded' }),
        onError: err => {
          onFailed();
          dispatch({
            type: 'failed',
            error: t(apiErrorCode(err) === GrpcCode.FailedPrecondition ? 'transferInsufficient' : 'transferFailed'),
          });
        },
      },
    );
  };

  return (
    <>
      <Button variant="primary" className="w-full sm:w-auto" onPress={open}>
        <Icon icon="solar:arrow-right-linear" width={16} />
        {t('transfer')}
      </Button>
      <WalletActionModal state={state} action={action} successTitle={t('transferSuccess')}>
        {form.step === 'confirm' ? (
          <TransferConfirmStep
            key="confirm"
            recipient={recipientOption}
            amount={amountValue}
            balance={balance}
            error={form.error}
            exceedsBalance={exceedsBalance}
            isPending={action.isPending}
            onBack={() => dispatch({ type: 'backToForm' })}
            onConfirm={confirm}
          />
        ) : (
          <React.Fragment key="form">
            <Modal.Header>
              <Modal.Heading>{t('transferMoney')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <TextField validationBehavior="aria" isInvalid={showAmountError}>
                <Label>{t('amountLabel')}</Label>
                <Input
                  autoFocus
                  placeholder="0.00"
                  type="number"
                  min={0}
                  max={balance}
                  step={GOLD_STEP}
                  inputMode="decimal"
                  value={form.amount}
                  variant="secondary"
                  onChange={e => dispatch({ type: 'amountChanged', amount: e.target.value })}
                />
                {showAmountError && <FieldError>{amountError}</FieldError>}
              </TextField>
              <MemberComboBox
                members={recipientOptions}
                value={form.recipient}
                onChange={recipient => dispatch({ type: 'recipientChanged', recipient })}
                label={t('recipient')}
                placeholder={t('searchRecipient')}
                emptyMessage={t('noResults')}
                isInvalid={showRecipientError}
                errorMessage={recipientError}
              />
              <p className="type-caption text-hint px-1">
                {t('available')} {formatGold(balance)}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button variant="primary" onPress={e => review(e.target)}>
                {t('continue')}
              </Button>
            </Modal.Footer>
          </React.Fragment>
        )}
      </WalletActionModal>
    </>
  );
}
