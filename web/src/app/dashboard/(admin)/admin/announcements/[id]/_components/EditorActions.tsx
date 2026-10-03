'use client';

import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import type { AnnouncementEditor } from '../_hooks/useAnnouncementEditor';

type EditorActionsProps = {
  editor: AnnouncementEditor;
  isDraft: boolean;
  canPublish: boolean;
};

export function EditorActions({ editor, isDraft, canPublish }: EditorActionsProps) {
  const t = useTranslations('adminPage');
  const format = useIntlFormatter();
  const { saveState, lastSavedAt, isPublishing } = editor;

  const formatSavedAt = (value: string) =>
    format.dateTime(new Date(value), {
      hour: '2-digit',
      minute: '2-digit',
    });

  const saveStatus = {
    saved: { icon: 'solar:check-circle-linear', className: 'text-hint', label: lastSavedAt ? t('savedAt', { time: formatSavedAt(lastSavedAt) }) : t('saved') },
    dirty: { icon: 'solar:pen-linear', className: 'text-hint', label: t('unsavedChanges') },
    saving: { icon: 'solar:refresh-linear', className: 'text-hint', label: t('saving') },
    error: { icon: 'solar:danger-triangle-linear', className: 'text-danger', label: isDraft ? t('saveFailed') : t('saveChangesFailed') },
  }[saveState];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="status" aria-live="polite" className={`flex items-center gap-1.5 type-caption ${saveStatus.className}`}>
        <Icon icon={saveStatus.icon} width={14} className={saveState === 'saving' ? 'animate-spin' : undefined} />
        <span>{saveStatus.label}</span>
        {saveState === 'error' && isDraft && (
          <Button variant="ghost" size="sm" className="max-sm:h-11" onPress={() => { void editor.save(); }}>
            {t('retry')}
          </Button>
        )}
      </div>

      {isDraft ? (
        <div className="flex items-center gap-2">
          <Button variant="danger" size="sm" className="max-sm:h-11" onPress={() => editor.setPendingConfirm('delete')} isDisabled={isPublishing}>
            <Icon icon="solar:trash-bin-trash-linear" width={16} />
            {t('deleteDraft')}
          </Button>
          <Button variant="primary" size="sm" className="max-sm:h-11" onPress={editor.publish} isPending={isPublishing} isDisabled={!canPublish}>
            <Icon icon="solar:plain-linear" width={16} />
            {t('publish')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={() => editor.setPendingConfirm('unpublish')} isDisabled={saveState === 'saving'}>
            <Icon icon="solar:undo-left-linear" width={16} />
            {t('unpublish')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="max-sm:h-11"
            onPress={() => { void editor.save(); }}
            isPending={saveState === 'saving'}
            isDisabled={!canPublish || (saveState !== 'dirty' && saveState !== 'error')}
          >
            <Icon icon="solar:diskette-linear" width={16} />
            {t('saveChanges')}
          </Button>
        </div>
      )}
    </div>
  );
}
