'use client';

import { Button, FieldError, Input, Label, Modal, TextArea, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { NOTE_MAX_LENGTH } from '../_lib/contributions';
import { InfoNote } from './InfoNote';

type ContributeModalProps = {
  guildId: string;
  onContributed: () => void;
};

export function ContributeModal({ guildId, onContributed }: ContributeModalProps) {
  const t = useTranslations('guildBankPage');
  const notify = useToast();
  const state = useOverlayState();
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
  const [isContributing, setIsContributing] = React.useState(false);

  const amountValue = parseGold(amount);
  const amountError = amountValue > 0 ? null : t('amountMustBePositive');
  const showAmountError = Boolean(amountError) && (showErrors || amount !== '');

  const open = () => {
    setShowErrors(false);
    state.open();
  };

  const handleContribute = async (trigger: Element) => {
    if (amountError) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsContributing(true);
    try {
      await apiClient.contributeFunds(guildId, { amount: amountValue, note: note || undefined });
      onContributed();
      notify.success(t('contributeSuccess'));
      setAmount('');
      setNote('');
      state.close();
    } catch {
      notify.error(t('contributeFailed'));
    } finally {
      setIsContributing(false);
    }
  };

  return (
    <>
      <Button variant="primary" className="w-full sm:w-auto" onPress={open}>
        <Icon icon="solar:arrow-down-linear" width={16} />
        {t('contribute')}
      </Button>
      <Modal state={state}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('contributeTitle')}</Modal.Heading>
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
                <TextField>
                  <Label>{t('noteOptional')}</Label>
                  <TextArea
                    placeholder={t('notePlaceholder')}
                    value={note}
                    variant="secondary"
                    maxLength={NOTE_MAX_LENGTH}
                    rows={2}
                    onChange={e => setNote(e.target.value)}
                  />
                </TextField>
                <InfoNote tone="warning">{t('contributeNote')}</InfoNote>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t('cancel')}
                </Button>
                <Button variant="primary" onPress={e => handleContribute(e.target)} isPending={isContributing}>
                  {t('contribute')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
