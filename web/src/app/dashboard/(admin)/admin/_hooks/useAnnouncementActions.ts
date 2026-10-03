'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import type { AdminAnnouncement } from '@/types/admin';

type AnnouncementActionsOptions = {
  guildId: string;
  onDraftDeleted: (id: string) => void;
  onUnpublished: () => void;
};

export function useAnnouncementActions({ guildId, onDraftDeleted, onUnpublished }: AnnouncementActionsOptions) {
  const t = useTranslations('adminPage');
  const notify = useToast();
  const router = useRouter();
  const [isCreatingDraft, setIsCreatingDraft] = React.useState(false);
  const [createDraftFailed, setCreateDraftFailed] = React.useState(false);

  const postAnnouncement = async () => {
    setIsCreatingDraft(true);
    setCreateDraftFailed(false);
    try {
      const draft = await apiClient.createAnnouncementDraft(guildId);
      router.push(`/dashboard/admin/announcements/${draft.id}`);
    } catch {
      setCreateDraftFailed(true);
      setIsCreatingDraft(false);
    }
  };

  const deleteDraft = async (draft: AdminAnnouncement) => {
    await apiClient.deleteAnnouncementDraft(guildId, draft.id);
    onDraftDeleted(draft.id);
    notify.success(t('draftDeleted'));
  };

  const unpublish = async (ann: AdminAnnouncement) => {
    await apiClient.unpublishAnnouncement(guildId, ann.id);
    onUnpublished();
    notify.success(t('announcementUnpublished'));
  };

  return { isCreatingDraft, createDraftFailed, postAnnouncement, deleteDraft, unpublish };
}

export type AnnouncementActions = ReturnType<typeof useAnnouncementActions>;
