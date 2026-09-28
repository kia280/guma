'use client';

import { AlertDialog, Button, Spinner } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ActionSuccess } from './ActionSuccess';

export function ConfirmDialog({
  heading,
  body,
  confirmLabel,
  failedMessage,
  status = 'danger',
  isOpen,
  onOpenChange,
  onConfirm,
  success,
}: {
  heading: string;
  body: string;
  confirmLabel: string;
  failedMessage: string;
  status?: 'danger' | 'warning';
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => Promise<void> | void;
  success?: { title: string; detail?: string };
}) {
  const t = useTranslations('adminPage');
  const [isPending, setIsPending] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [isDone, setIsDone] = React.useState(false);
  const [wasOpen, setWasOpen] = React.useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setIsDone(false);
  }

  const handleOpenChange = (open: boolean) => {
    if (isPending) return;
    if (!open) setFailed(false);
    onOpenChange(open);
  };

  const confirm = async () => {
    setIsPending(true);
    setFailed(false);
    try {
      await onConfirm();
      if (success) setIsDone(true);
      else onOpenChange(false);
    } catch (err) {
      console.error('Confirmed action failed', err);
      setFailed(true);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable={!isPending}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            {isDone && success ? (
              <ActionSuccess title={success.title} detail={success.detail} />
            ) : (
              <>
                <AlertDialog.Header>
                  <AlertDialog.Icon status={status} />
                  <AlertDialog.Heading>{heading}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body className="flex flex-col gap-2">
                  <p className="type-body text-subtle">{body}</p>
                  {failed && (
                    <p role="alert" className="type-caption text-danger">
                      {failedMessage}
                    </p>
                  )}
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <Button slot="close" variant="tertiary" isDisabled={isPending}>
                    {t('cancel')}
                  </Button>
                  <Button variant={status === 'danger' ? 'danger' : 'primary'} onPress={confirm} isPending={isPending}>
                    {({ isPending }) => (
                      <>
                        {isPending && <Spinner color="current" size="sm" />}
                        {confirmLabel}
                      </>
                    )}
                  </Button>
                </AlertDialog.Footer>
              </>
            )}
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
