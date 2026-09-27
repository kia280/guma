'use client';

import { Button, Modal, Spinner, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import type { ItemHistoryEvent, ItemHistoryKind } from '@/types/item';

type LoadStatus = 'loading' | 'ready' | 'error';

const KIND_ICONS: Record<ItemHistoryKind, string> = {
  looted: 'solar:clipboard-check-linear',
  donated: 'solar:safe-2-linear',
  requested: 'solar:hand-stars-linear',
  request_approved: 'solar:check-circle-linear',
  request_rejected: 'solar:close-circle-linear',
  received: 'solar:backpack-linear',
  auction_listed: 'solar:sledgehammer-linear',
  lottery_listed: 'solar:ticket-linear',
  returned: 'solar:undo-left-linear',
  withdrawn: 'solar:arrow-up-linear',
  retracted: 'solar:trash-bin-minimalistic-linear',
};

const RECEIVED_SOURCES = ['auction', 'lottery', 'transfer', 'checkin', 'bank_item_request', 'bank'] as const;

const referenceHref = (event: ItemHistoryEvent): string | undefined => {
  if (!event.referenceId) return undefined;
  switch (event.source) {
    case 'auction':
      return `/dashboard/auction/${event.referenceId}`;
    case 'lottery':
      return `/dashboard/lottery/${event.referenceId}`;
    case 'checkin':
      return `/dashboard/attendance/${event.referenceId}`;
    default:
      return undefined;
  }
};

type ItemHistoryModalProps = {
  state: UseOverlayStateReturn;
  itemId: string | null;
  itemName: string;
};

export function ItemHistoryModal({ state, itemId, itemName }: ItemHistoryModalProps) {
  const t = useTranslations('itemHistory');
  const format = useIntlFormatter();
  const guildId = useCurrentGuildId();
  const [result, setResult] = React.useState<{ itemId: string; events: ItemHistoryEvent[] | null } | null>(null);

  const load = React.useCallback(() => {
    if (!itemId) return;
    apiClient
      .getItemHistory(guildId, itemId)
      .then(next => setResult({ itemId, events: next }))
      .catch(() => setResult({ itemId, events: null }));
  }, [guildId, itemId]);

  React.useEffect(() => {
    if (state.isOpen) load();
  }, [state.isOpen, load]);

  const retry = () => {
    setResult(null);
    load();
  };

  const isCurrent = result !== null && result.itemId === itemId;
  const status: LoadStatus = !isCurrent ? 'loading' : result.events === null ? 'error' : 'ready';
  const events = isCurrent ? result.events ?? [] : [];

  const describe = (event: ItemHistoryEvent) => {
    const actor = event.actorName || t('someone');
    const subject = event.subjectName || t('someone');
    const label = event.referenceLabel;
    if (event.kind === 'received') {
      const source = RECEIVED_SOURCES.find(s => s === event.source) ?? 'other';
      return t(`received.${source === 'bank_item_request' ? 'bank' : source}`, { actor, subject, label });
    }
    if (event.kind === 'returned') {
      return t(event.source === 'bank' ? 'returned.bank' : 'returned.backpack', { actor });
    }
    return t(`kinds.${event.kind}`, { actor, subject, label });
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="md" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('title', { item: itemName })}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {status === 'loading' ? (
                <div className="flex justify-center py-10">
                  <Spinner aria-label={t('loading')} />
                </div>
              ) : status === 'error' ? (
                <div role="alert" className="flex flex-col items-center gap-3 py-8">
                  <p className="type-body text-danger">{t('loadFailed')}</p>
                  <Button size="sm" variant="secondary" onPress={retry}>
                    {t('retry')}
                  </Button>
                </div>
              ) : events.length === 0 ? (
                <p className="type-body text-disabled py-8 text-center">{t('empty')}</p>
              ) : (
                <ol className="relative flex flex-col gap-4 border-l border-divider pl-6 ml-3" aria-label={t('timeline')}>
                  {events.map(event => {
                    const href = referenceHref(event);
                    return (
                      <li key={event.id} className="relative">
                        <span className="absolute -left-[37px] flex size-6 items-center justify-center rounded-full border border-divider bg-surface">
                          <Icon icon={KIND_ICONS[event.kind] ?? 'solar:record-linear'} width={14} className="text-subtle" aria-hidden />
                        </span>
                        <p className="type-body text-foreground">{describe(event)}</p>
                        <div className="flex flex-wrap items-center gap-x-2 type-caption text-hint">
                          <time dateTime={event.createdAt}>
                            {format.dateTime(new Date(event.createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
                          </time>
                          {href && (
                            <Link
                              href={href}
                              className="rounded text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            >
                              {t(`view.${event.source}`)}
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
