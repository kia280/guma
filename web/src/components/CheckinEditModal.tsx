'use client';

import { Button, Chip, Modal, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { CheckinFormFields, hasCheckinFormErrors, useCheckinFormErrors, type CheckinFormValues } from '@/components/CheckinFormFields';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import type { CheckinEntry } from '@/types/checkin';

type SaveError = 'closed' | 'forbidden' | 'invalid' | 'failed';

const toFormValues = (entry: CheckinEntry): CheckinFormValues => ({
  title: entry.title,
  description: entry.description ?? '',
  datetime: entry.date,
  expireTime: entry.expireTime ?? '',
  imageUrl: entry.imageUrl ?? '',
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

export function CheckinEditModal({
  entry,
  state,
  onSaved,
  onClosed,
}: {
  entry: CheckinEntry;
  state: UseOverlayStateReturn;
  onSaved: (updated: CheckinEntry) => void;
  onClosed: () => void;
}) {
  const t = useTranslations('checkIn');
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const [values, setValues] = React.useState<CheckinFormValues>(() => toFormValues(entry));
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<SaveError | null>(null);
  const errors = useCheckinFormErrors(values, { requireFutureExpire: true });

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (state.isOpen && !wasOpenRef.current) {
      setValues(toFormValues(entry));
      setShowErrors(false);
      setSaveError(null);
    }
    wasOpenRef.current = state.isOpen;
  }, [state.isOpen, entry]);

  const updateValues = (updates: Partial<CheckinFormValues>) => {
    setValues(current => ({ ...current, ...updates }));
    setSaveError(null);
  };

  const handleSave = async (trigger: Element) => {
    if (hasCheckinFormErrors(errors)) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await apiClient.updateCheckin(guildId, entry.id, {
        title: values.title.trim(),
        description: values.description.trim(),
        datetime: values.datetime,
        expireTime: values.expireTime,
        imageUrl: values.imageUrl.trim(),
      });
      onSaved(updated);
      notify.success(t('editSuccess'));
      state.close();
    } catch (err) {
      const error = toSaveError(err);
      setSaveError(error);
      if (error === 'closed') onClosed();
    } finally {
      setIsSaving(false);
    }
  };

  const saveErrorMessage = {
    closed: t('editClosed'),
    forbidden: t('editForbidden'),
    invalid: t('editInvalid'),
    failed: t('editFailed'),
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-center gap-2 pr-8">
              <Icon icon="solar:pen-linear" width={18} className="shrink-0" />
              <Modal.Heading>{t('editCheckIn')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <CheckinFormFields
                values={values}
                errors={errors}
                showErrors={showErrors}
                onChange={updateValues}
                loot={
                  <div className="flex flex-col gap-2">
                    <p className="type-body font-medium text-foreground">{t('lootList')}</p>
                    {entry.lootList.length === 0 ? (
                      <p className="type-body text-subtle">{t('noLoot')}</p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {entry.lootList.map(item => (
                          <li key={item.id}>
                            <Chip size="sm" variant="secondary">
                              {item.name}
                            </Chip>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="type-caption text-hint flex items-start gap-1.5">
                      <Icon icon="solar:lock-keyhole-linear" width={12} className="mt-0.5 shrink-0" />
                      <span>{t('lootLockedHint')}</span>
                    </p>
                  </div>
                }
              />
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
                onPress={e => handleSave(e.target)}
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
