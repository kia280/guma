'use client';

import { Button, Modal, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { AuctionStatus, type AuctionItem, type UpdateAuctionRequest } from '@/types/auction';
import {
  AuctionItemFields,
  AuctionPricingFields,
  type AuctionItemValues,
  type AuctionPricingValues,
} from './AuctionFormFields';
import { DateTimePicker } from './DateTimePicker';
import { ItemThumbnail } from './ItemThumbnail';

type SaveError = 'closed' | 'forbidden' | 'invalid' | 'failed';

type AuctionEditValues = AuctionItemValues & AuctionPricingValues & { startTime: string; endTime: string };

const toFormValues = (item: AuctionItem): AuctionEditValues => ({
  name: item.name,
  description: item.description,
  category: item.category,
  rarity: item.rarity,
  startingBid: item.startingBid,
  minBidIncrement: item.minBidIncrement,
  startTime: item.startTime,
  endTime: item.endTime,
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

const time = (value: string) => new Date(value).getTime();

export function AuctionEditModal({
  item,
  state,
  onSaved,
  onRejected,
}: {
  item: AuctionItem;
  state: UseOverlayStateReturn;
  onSaved: (updated: AuctionItem) => void;
  onRejected: () => void;
}) {
  const t = useTranslations('auctionEditModal');
  const labels = useTranslations('createAuctionModal');
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const now = useNow(30_000);
  const [values, setValues] = React.useState<AuctionEditValues>(() => toFormValues(item));
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<SaveError | null>(null);

  const [wasOpen, setWasOpen] = React.useState(state.isOpen);
  if (state.isOpen !== wasOpen) {
    setWasOpen(state.isOpen);
    if (state.isOpen) {
      setValues(toFormValues(item));
      setShowErrors(false);
      setSaveError(null);
    }
  }

  const hasBids = !!item.currentBidder;
  const isUpcoming = item.status === AuctionStatus.UPCOMING;
  const canEditItem = !item.sourceType && !hasBids;

  const endBeforeStart = time(values.endTime) <= time(values.startTime);
  const endInPast = time(values.endTime) <= now;
  const endShortened = hasBids && time(values.endTime) < time(item.endTime);
  const errors = {
    name: canEditItem && !values.name.trim() ? t('nameRequired') : null,
    startingBid: !hasBids && !(values.startingBid > 0) ? t('amountRequired') : null,
    minBidIncrement: !hasBids && !(values.minBidIncrement > 0) ? t('amountRequired') : null,
    startTime: isUpcoming && time(values.startTime) <= now ? t('startInPast') : null,
    endTime: !values.endTime
      ? t('endRequired')
      : endBeforeStart
        ? t('endBeforeStart')
        : endInPast
          ? t('endInPast')
          : endShortened
            ? t('endShortened')
            : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const visible = <T,>(error: T) => (showErrors ? error : null);

  const updateValues = (updates: Partial<AuctionEditValues>) => {
    setValues(current => ({ ...current, ...updates }));
    setSaveError(null);
  };

  const handleSave = async (trigger: Element) => {
    if (hasErrors) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const patch: UpdateAuctionRequest = { endTime: values.endTime };
    if (canEditItem) {
      patch.item = {
        name: values.name.trim(),
        description: values.description.trim(),
        category: values.category,
        rarity: values.rarity,
      };
    }
    if (!hasBids) {
      patch.startingBid = values.startingBid;
      patch.minBidIncrement = values.minBidIncrement;
    }
    if (isUpcoming) patch.startTime = values.startTime;

    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await apiClient.updateAuction(guildId, item.id, patch);
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
                {canEditItem ? (
                  <AuctionItemFields values={values} onChange={updateValues} nameError={visible(errors.name)} autoFocus />
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-divider bg-surface-secondary p-3">
                    <ItemThumbnail category={item.category} rarity={item.rarity} imageUrl={item.imageUrl} />
                    <div className="min-w-0">
                      <p className="type-body font-medium text-foreground truncate">{item.name}</p>
                      <p className="type-caption text-hint">
                        {labels(`rarities.${item.rarity}`)} · {labels(`categories.${item.category}`)}
                      </p>
                    </div>
                  </div>
                )}
                {item.sourceType && (
                  <p className="type-caption text-hint flex items-start gap-1.5">
                    <Icon icon="solar:lock-keyhole-linear" width={12} className="mt-0.5 shrink-0" />
                    <span>{t('itemLockedHint', { source: item.sourceType })}</span>
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <AuctionPricingFields
                    values={values}
                    onChange={updateValues}
                    isDisabled={hasBids}
                    errors={{
                      startingBid: visible(errors.startingBid),
                      minBidIncrement: visible(errors.minBidIncrement),
                    }}
                  />
                  {hasBids && (
                    <p className="type-caption text-hint flex items-start gap-1.5">
                      <Icon icon="solar:lock-keyhole-linear" width={12} className="mt-0.5 shrink-0" />
                      <span>{t('pricingLockedHint')}</span>
                    </p>
                  )}
                </div>

                {isUpcoming && (
                  <DateTimePicker
                    isRequired
                    label={t('startTime')}
                    value={values.startTime}
                    onChange={startTime => updateValues({ startTime })}
                    validationBehavior="aria"
                    isInvalid={!!visible(errors.startTime)}
                    errorMessage={visible(errors.startTime) ?? undefined}
                  />
                )}
                <DateTimePicker
                  isRequired
                  label={t('endTime')}
                  value={values.endTime}
                  onChange={endTime => updateValues({ endTime })}
                  validationBehavior="aria"
                  isInvalid={!!visible(errors.endTime)}
                  errorMessage={visible(errors.endTime) ?? undefined}
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
