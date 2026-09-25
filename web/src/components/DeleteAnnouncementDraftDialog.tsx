'use client';

import React from 'react';
import { AlertDialog, Button } from '@heroui/react';
import { useTranslations } from 'next-intl';

export function DeleteAnnouncementDraftDialog({
  title,
  isOpen,
  onOpenChange,
  onConfirm,
}: {
  title: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations('adminPage');
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const handleOpenChange = (open: boolean) => {
    if (isDeleting) return;
    if (!open) setFailed(false);
    onOpenChange(open);
  };

  const confirm = async () => {
    setIsDeleting(true);
    setFailed(false);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to delete announcement draft', err);
      setFailed(true);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange} isDismissable={!isDeleting}>
        <AlertDialog.Container size="sm">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{t('deleteDraftTitle')}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-2">
              <p className="type-body text-subtle">
                {t('deleteDraftBody', { title: title.trim() || t('untitledDraft') })}
              </p>
              {failed && (
                <p role="alert" className="type-caption text-danger">
                  {t('deleteDraftFailed')}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" isDisabled={isDeleting}>
                {t('cancel')}
              </Button>
              <Button variant="danger" onPress={confirm} isPending={isDeleting}>
                {t('delete')}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
