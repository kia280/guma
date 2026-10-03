'use client';

import { Card, Chip, Skeleton } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent } from '@/components/AsyncContent';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { AnnouncementFields } from './_components/AnnouncementFields';
import { EditorActions } from './_components/EditorActions';
import { useAnnouncementEditor } from './_hooks/useAnnouncementEditor';

export default function AnnouncementEditorPage() {
  const t = useTranslations('adminPage');
  const editor = useAnnouncementEditor();
  const { announcement, values, pendingConfirm, setPendingConfirm } = editor;

  if (editor.isMissing) {
    return (
      <div className="space-y-5">
        <Card className="border border-transparent shadow-edge bg-surface">
          <Card.Content className="p-6 text-center">
            <p className="type-subheading text-foreground">{t('draftNotFound')}</p>
            <p className="type-body text-subtle mt-1">{t('draftNotFoundHint')}</p>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="space-y-5">
        <AsyncContent
          state={editor.loadState}
          onRetry={editor.reload}
          skeleton={
            <div className="space-y-5" aria-busy="true" aria-label={t('loadingDraft')}>
              <Skeleton className="h-8 w-1/2 rounded-lg" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          }
        >
          {null}
        </AsyncContent>
      </div>
    );
  }

  const isDraft = announcement.status === 'draft';
  const canPublish = values.title.trim() !== '' && values.content.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHeader title={t('editAnnouncement')} description={isDraft ? t('editAnnouncementHint') : t('editPublishedHint')}>
        {isDraft
          ? <Chip size="sm" variant="secondary" color="warning">{t('draft')}</Chip>
          : <Chip size="sm" variant="secondary" color="success">{t('published')}</Chip>}
      </PageHeader>

      <AnnouncementFields values={values} onChange={editor.update} />

      <EditorActions editor={editor} isDraft={isDraft} canPublish={canPublish} />

      {!canPublish && (
        <p className="type-caption text-hint text-right">{isDraft ? t('publishRequirement') : t('publishedRequirement')}</p>
      )}
      {editor.publishFailed && (
        <p role="alert" className="type-caption text-danger text-right">{t('publishFailed')}</p>
      )}

      <ConfirmDialog
        heading={t('deleteDraftTitle')}
        body={t('deleteDraftBody', { title: values.title.trim() || t('untitledDraft') })}
        confirmLabel={t('delete')}
        failedMessage={t('deleteDraftFailed')}
        isOpen={pendingConfirm === 'delete'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={editor.deleteDraft}
      />
      <ConfirmDialog
        heading={t('unpublishTitle')}
        body={t('unpublishBody', { title: values.title })}
        confirmLabel={t('unpublish')}
        failedMessage={t('unpublishFailed')}
        status="warning"
        isOpen={pendingConfirm === 'unpublish'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={editor.unpublish}
      />
      <ConfirmDialog
        heading={t('discardChangesTitle')}
        body={t('discardChangesBody')}
        confirmLabel={t('discardChanges')}
        failedMessage={t('discardFailed')}
        status="warning"
        isOpen={pendingConfirm === 'discard'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={editor.discardAndLeave}
      />
    </div>
  );
}
