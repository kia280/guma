'use client';

import { Button, Chip, Modal, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { formatPrize, useFormatGold } from '@/lib/guma/useFormatGold';
import type { Lottery, UpdateLotteryRequest } from '@/types/lottery';
import { LotteryFormFields, type LotteryFormErrors, type LotteryFormValues } from './LotteryFormFields';

type SaveError = 'closed' | 'forbidden' | 'invalid' | 'failed';

const toFormValues = (lottery: Lottery): LotteryFormValues => ({
  title: lottery.title,
  description: lottery.description ?? '',
  ticketPrice: lottery.ticketPrice,
  maxTickets: lottery.maxTickets,
  drawDate: lottery.drawDate,
});

const toSaveError = (err: unknown): SaveError => {
  switch (apiErrorCode(err)) {
    case GrpcCode.FailedPrecondition:
      return 'closed';
    case GrpcCode.PermissionDenied:
      return 'forbidden';
    case GrpcCode.InvalidArgument:
      return 'invalid';
    default:
      return 'failed';
  }
};

function LockedHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="type-caption text-hint flex items-start gap-1.5">
      <Icon icon="solar:lock-keyhole-linear" width={12} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function LotteryEditModal({
  lottery,
  state,
  onSaved,
  onRejected,
}: {
  lottery: Lottery;
  state: UseOverlayStateReturn;
  onSaved: (updated: Lottery) => void;
  onRejected: () => void;
}) {
  const t = useTranslations('lotteryEditModal');
  const create = useTranslations('createLotteryModal');
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const formatGold = useFormatGold();
  const now = useNow(30_000);
  const [values, setValues] = React.useState<LotteryFormValues>(() => toFormValues(lottery));
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<SaveError | null>(null);

  const [wasOpen, setWasOpen] = React.useState(state.isOpen);
  if (state.isOpen !== wasOpen) {
    setWasOpen(state.isOpen);
    if (state.isOpen) {
      setValues(toFormValues(lottery));
      setShowErrors(false);
      setSaveError(null);
    }
  }

  const ticketsLocked = lottery.ticketsSold > 0;
  const drawInPast = new Date(values.drawDate).getTime() <= now;
  const errors: LotteryFormErrors = {
    title: values.title.trim() ? null : t('titleRequired'),
    ticketPrice: !ticketsLocked && !(values.ticketPrice > 0) ? t('ticketPriceRequired') : null,
    maxTickets: !ticketsLocked && !(values.maxTickets >= 1) ? t('maxTicketsRequired') : null,
    drawDate: drawInPast ? create('drawDateInPast') : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const visibleErrors: LotteryFormErrors = showErrors ? errors : { drawDate: errors.drawDate };

  const updateValues = (updates: Partial<LotteryFormValues>) => {
    setValues(current => ({ ...current, ...updates }));
    setSaveError(null);
  };

  const handleSave = async (trigger: Element) => {
    if (hasErrors) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const patch: UpdateLotteryRequest = {
      title: values.title.trim(),
      description: values.description.trim(),
      drawDate: values.drawDate,
    };
    if (!ticketsLocked) {
      patch.ticketPrice = values.ticketPrice;
      patch.maxTickets = values.maxTickets;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await apiClient.updateLottery(guildId, lottery.id, patch);
      onSaved(updated);
      notify.success(t('success'));
      state.close();
    } catch (err) {
      const error = toSaveError(err);
      setSaveError(error);
      if (error === 'closed') onRejected();
    } finally {
      setIsSaving(false);
    }
  };

  const saveErrorMessage: Record<SaveError, string> = {
    closed: t('closed'),
    forbidden: t('forbidden'),
    invalid: t('invalid'),
    failed: t('failed'),
  };
  const prizes = lottery.prizes ?? [];

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-center gap-2 pr-8">
              <Icon icon="solar:pen-linear" width={18} className="shrink-0" />
              <Modal.Heading>{t('title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form className="flex flex-col gap-4" onSubmit={event => event.preventDefault()}>
                <LotteryFormFields
                  values={values}
                  errors={visibleErrors}
                  onChange={updateValues}
                  validationBehavior="aria"
                  ticketsLocked={ticketsLocked}
                  ticketsHint={ticketsLocked && <LockedHint>{t('ticketsLockedHint')}</LockedHint>}
                  prizes={
                    <div className="flex flex-col gap-2">
                      <p className="type-body font-medium text-foreground">{t('prizes')}</p>
                      {prizes.length === 0 ? (
                        <p className="type-body text-subtle">{t('noPrizes')}</p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5">
                          {prizes.map(prize => (
                            <li key={prize.rank}>
                              <Chip size="sm" variant="secondary">
                                {formatPrize(prize.itemName ?? prize.description, prize.amount, formatGold)}
                              </Chip>
                            </li>
                          ))}
                        </ul>
                      )}
                      <LockedHint>{t('prizesLockedHint')}</LockedHint>
                    </div>
                  }
                />
              </form>
              {saveError && (
                <p role="alert" className="type-caption text-danger mt-4">
                  {saveErrorMessage[saveError]}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" isDisabled={isSaving}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={event => handleSave(event.target)}
                isPending={isSaving}
                isDisabled={saveError === 'closed'}
              >
                {t('save')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
