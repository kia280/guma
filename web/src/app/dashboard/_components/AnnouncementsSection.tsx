'use client';

import { Button, Card, Modal, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import type { Announcement } from '@/types/dashboard';

export function AnnouncementsSection({ announcements }: { announcements: Announcement[] }) {
  const t = useTranslations('dashboard');
  const format = useIntlFormatter();
  const formatAnnouncementDate = (value: string) =>
    format.dateTime(new Date(value), { year: 'numeric', month: '2-digit', day: '2-digit' });
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const annModalState = useOverlayState({
    onOpenChange: (isOpen) => {
      if (!isOpen) setSelectedAnn(null);
    },
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon icon="solar:volume-loud-linear" width={18} className="text-hint" />
        <h2 className="type-heading text-foreground">{t('news')}</h2>
      </div>
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Content className="p-1.5">
          {announcements.length === 0 ? (
            <EmptyContent icon="solar:volume-loud-linear" title={t('noAnnouncements')} />
          ) : (
            <ul className="flex flex-col gap-0.5">
              {announcements.map(ann => (
                <li key={ann.id}>
                  <button
                    type="button"
                    className={`w-full text-left ${LIST_ROW_CLASS}`}
                    onClick={() => { setSelectedAnn(ann); annModalState.open(); }}
                  >
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {ann.pinned && (
                          <Icon icon="solar:pin-linear" width={14} className="text-danger shrink-0 mt-0.5" />
                        )}
                        <p className="type-body text-foreground line-clamp-2 wrap-break-word sm:line-clamp-1">{ann.title}</p>
                      </div>
                      <span className="type-caption text-hint shrink-0">{formatAnnouncementDate(ann.date)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Modal state={annModalState}>
        <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog className="bg-surface max-w-2xl">
              <Modal.CloseTrigger />
              <Modal.Header className="flex-row items-start gap-3 border-b border-divider pb-3 pr-10">
                {selectedAnn?.pinned && (
                  <Icon icon="solar:pin-bold" width={16} className="text-danger shrink-0 mt-0.5" />
                )}
                <Modal.Heading>{selectedAnn?.title}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="type-body text-subtle">{selectedAnn && formatAnnouncementDate(selectedAnn.date)}</p>
                <DiscordMarkdown content={selectedAnn?.content ?? ''} className="type-prose text-foreground" />
              </Modal.Body>
              <Modal.Footer className="border-t border-divider pt-3">
                <Button slot="close" variant="secondary" size="sm">
                  {t('close')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </section>
  );
}
