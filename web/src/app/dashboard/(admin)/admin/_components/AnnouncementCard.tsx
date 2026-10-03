'use client';

import { Button, Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { useUserName } from '@/hooks/useUserName';
import type { AdminAnnouncement } from '@/types/admin';
import { useIntlLocale } from '../_hooks/useIntlLocale';
import { formatRelative } from '../_lib/format';

type AnnouncementCardProps = {
  announcement: AdminAnnouncement;
  onDelete: (announcement: AdminAnnouncement) => void;
  onUnpublish: (announcement: AdminAnnouncement) => void;
};

export function AnnouncementCard({ announcement: ann, onDelete, onUnpublish }: AnnouncementCardProps) {
  const t = useTranslations('adminPage');
  const userName = useUserName();
  const router = useRouter();
  const intlLocale = useIntlLocale();
  const edit = () => router.push(`/dashboard/admin/announcements/${ann.id}`);

  if (ann.status === 'draft') {
    return (
      <Card className="border border-dashed border-divider shadow-none bg-surface">
        <Card.Content className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 min-w-0 type-body">
                <Chip size="sm" variant="secondary" color="warning" className="shrink-0">{t('draft')}</Chip>
                <h4 className={`type-subheading line-clamp-2 wrap-break-word ${ann.title.trim() ? 'text-foreground' : 'text-hint'}`}>
                  {ann.title.trim() || t('untitledDraft')}
                </h4>
              </div>
              {ann.content.trim() && (
                <DiscordMarkdown content={ann.content} className="type-body text-subtle line-clamp-3" />
              )}
              <p className="type-caption text-hint mt-2">
                {t('lastSaved', { time: formatRelative(new Date(ann.updatedAt), intlLocale) })}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={edit}>
                <Icon icon="solar:pen-linear" width={16} />
                {t('editDraft')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="max-sm:size-11"
                aria-label={t('deleteDraft')}
                onPress={() => onDelete(ann)}
              >
                <Icon icon="solar:trash-bin-trash-linear" width={16} className="text-danger" />
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Content className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {ann.pinned && (
                <Icon icon="solar:pin-bold" width={14} className="text-warning shrink-0" aria-label={t('pinned')} />
              )}
              <h4 className="type-subheading text-foreground line-clamp-2 wrap-break-word">{ann.title}</h4>
            </div>
            <DiscordMarkdown content={ann.content} className="type-body text-subtle line-clamp-3" />
            <div className="flex items-center gap-2 mt-2">
              <p className="type-caption text-hint">
                {t('by')} {userName(ann.author)}
              </p>
              <span className="type-caption text-disabled">·</span>
              <p className="type-caption text-hint">
                {formatRelative(new Date(ann.publishedAt ?? ann.createdAt), intlLocale)}
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-2 shrink-0 type-body sm:flex-col sm:items-end">
            {ann.pinned && (
              <Chip size="sm" variant="secondary" className="max-sm:hidden">
                {t('pinned')}
              </Chip>
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={edit}>
                <Icon icon="solar:pen-linear" width={16} />
                {t('editDraft')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                isIconOnly
                className="max-sm:size-11"
                aria-label={t('unpublish')}
                onPress={() => onUnpublish(ann)}
              >
                <Icon icon="solar:undo-left-linear" width={16} />
              </Button>
            </div>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
