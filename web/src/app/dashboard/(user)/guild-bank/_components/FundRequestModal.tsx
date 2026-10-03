'use client';

import { Button, FieldError, Input, Label, Modal, TextArea, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import type { GuildBank } from '@/types/guild-bank';
import { useRequestErrorMessage } from '../_hooks/useRequestErrorMessage';
import { REASON_MAX_LENGTH } from '../_lib/contributions';
import { InfoNote } from './InfoNote';
import { RequestErrorAlert } from './RequestErrorAlert';

type FundRequestModalProps = {
  guildId: string;
  bank: GuildBank | null;
  onRequested: () => void;
};

export function FundRequestModal({ guildId, bank, onRequested }: FundRequestModalProps) {
  const t = useTranslations('guildBankPage');
  const notify = useToast();
  const requestErrorMessage = useRequestErrorMessage();
  const state = useOverlayState();
  const [amount, setAmount] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const amountValue = parseGold(amount);
  const amountError = !(amountValue > 0)
    ? t('amountMustBePositive')
    : bank && amountValue > bank.balance
      ? t('errorExceedsBalance')
      : null;
  const reasonError = reason.trim() ? null : t('reasonRequired');
  const showAmountError = Boolean(amountError) && (showErrors || amount !== '');
  const showReasonError = Boolean(reasonError) && showErrors;

  const open = () => {
    setRequestError(null);
    setShowErrors(false);
    state.open();
  };

  const handleRequest = async (trigger: Element) => {
    if (amountError || reasonError) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsRequesting(true);
    setRequestError(null);
    try {
      await apiClient.requestFunds(guildId, { amount: amountValue, reason: reason.trim() });
      onRequested();
      notify.success(t('requestSuccess'));
      setAmount('');
      setReason('');
      state.close();
    } catch (err) {
      setRequestError(requestErrorMessage(err));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <>
      <Button variant="secondary" className="w-full sm:w-auto" onPress={open}>
        <Icon icon="solar:arrow-up-linear" width={16} />
        {t('requestFunds')}
      </Button>
      <Modal state={state}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('requestFundsTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <TextField validationBehavior="aria" isInvalid={showAmountError}>
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
                  {showAmountError && <FieldError>{amountError}</FieldError>}
                </TextField>
                <TextField validationBehavior="aria" isInvalid={showReasonError}>
                  <Label>{t('reason')}</Label>
                  <TextArea
                    placeholder={t('reasonPlaceholder')}
                    value={reason}
                    variant="secondary"
                    maxLength={REASON_MAX_LENGTH}
                    rows={3}
                    onChange={e => setReason(e.target.value)}
                  />
                  {showReasonError && <FieldError>{reasonError}</FieldError>}
                </TextField>
                <InfoNote tone="neutral">{t('fundRequestNote')}</InfoNote>
                <RequestErrorAlert error={requestError} />
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t('cancel')}
                </Button>
                <Button variant="primary" onPress={e => handleRequest(e.target)} isPending={isRequesting}>
                  {t('submitRequest')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
