'use client';

import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { LoadState } from '@/hooks/useLoadState';
import type { AdminAnnouncement } from '@/types/admin';
import type { AnnouncementActions } from '../_hooks/useAnnouncementActions';
import { AnnouncementCard } from './AnnouncementCard';

type AnnouncementsPanelProps = {
  announcements: AdminAnnouncement[];
  loadState: LoadState;
  onRetry: () => void;
  actions: AnnouncementActions;
};

export function AnnouncementsPanel({ announcements, loadState, onRetry, actions }: AnnouncementsPanelProps) {
  const t = useTranslations('adminPage');
  const [draftToDelete, setDraftToDelete] = React.useState<AdminAnnouncement | null>(null);
  const [toUnpublish, setToUnpublish] = React.useState<AdminAnnouncement | null>(null);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end items-center gap-3">
          {actions.createDraftFailed && (
            <p role="alert" className="type-caption text-danger">{t('createDraftFailed')}</p>
          )}
          <Button variant="primary" className="md:h-10" onPress={actions.postAnnouncement} isPending={actions.isCreatingDraft}>
            <Icon icon="solar:add-circle-linear" width={16} />
            {t('postAnnouncement')}
          </Button>
        </div>

        <AsyncContent state={loadState} onRetry={onRetry} skeleton={<ListSkeleton rows={3} />}>
          {announcements.length === 0 && (
            <Card className="border border-transparent shadow-edge bg-surface">
              <Card.Content>
                <EmptyContent icon="solar:volume-loud-linear" title={t('noAnnouncements')} />
              </Card.Content>
            </Card>
          )}

          <div className="space-y-3">
            {announcements.map(ann => (
              <AnnouncementCard key={ann.id} announcement={ann} onDelete={setDraftToDelete} onUnpublish={setToUnpublish} />
            ))}
          </div>
        </AsyncContent>
      </div>

      <ConfirmDialog
        heading={t('deleteDraftTitle')}
        body={t('deleteDraftBody', { title: draftToDelete?.title.trim() || t('untitledDraft') })}
        confirmLabel={t('delete')}
        failedMessage={t('deleteDraftFailed')}
        isOpen={draftToDelete !== null}
        onOpenChange={open => { if (!open) setDraftToDelete(null); }}
        onConfirm={() => (draftToDelete ? actions.deleteDraft(draftToDelete) : undefined)}
      />
      <ConfirmDialog
        heading={t('unpublishTitle')}
        body={t('unpublishBody', { title: toUnpublish?.title ?? '' })}
        confirmLabel={t('unpublish')}
        failedMessage={t('unpublishFailed')}
        status="warning"
        isOpen={toUnpublish !== null}
        onOpenChange={open => { if (!open) setToUnpublish(null); }}
        onConfirm={() => (toUnpublish ? actions.unpublish(toUnpublish) : undefined)}
      />
    </>
  );
}
