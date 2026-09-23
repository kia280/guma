'use client';

import React from 'react';
import Link from 'next/link';
import { Button, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useFormatter, useNow, useTranslations } from 'next-intl';

import { LIST_ROW_CLASS } from '@/lib/list-row';
import type { GuildNotification, NotificationKind, TradeResponse } from '@/types/notification';

const KIND_META: Record<NotificationKind, { icon: string; tint: string }> = {
  tradeOffer: { icon: 'solar:transfer-horizontal-linear', tint: 'bg-accent/10 text-accent' },
  transferReceived: { icon: 'solar:wallet-money-linear', tint: 'bg-success/10 text-success' },
  attendanceSettled: { icon: 'solar:check-circle-linear', tint: 'bg-success/10 text-success' },
  lootWon: { icon: 'solar:gift-linear', tint: 'bg-warning/10 text-warning' },
  auctionOutbid: { icon: 'solar:sledgehammer-linear', tint: 'bg-danger/10 text-danger' },
  auctionWon: { icon: 'solar:cup-star-linear', tint: 'bg-warning/10 text-warning' },
  lotteryWon: { icon: 'solar:ticket-linear', tint: 'bg-accent/10 text-accent' },
  bankRequestApproved: { icon: 'solar:safe-2-linear', tint: 'bg-success/10 text-success' },
};

export type NotificationItemProps = {
  notification: GuildNotification;
  onOpen: (id: string) => void;
  onRespond: (id: string, response: TradeResponse) => void;
};

export function NotificationItem({ notification, onOpen, onRespond }: NotificationItemProps) {
  const t = useTranslations('notificationItem');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60 * 1000 });
  const { id, kind, params, createdAt, isRead, href, response } = notification;
  const meta = KIND_META[kind];

  const body = (
    <>
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.tint)}>
        <Icon icon={meta.icon} width={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('type-body', isRead ? 'text-subtle' : 'text-foreground')}>
          {t.rich(kind, {
            ...params,
            b: chunks => <span className="font-medium text-foreground">{chunks}</span>,
          })}
        </p>
        <time dateTime={createdAt} className="type-caption text-hint">
          {format.relativeTime(new Date(createdAt), now)}
        </time>
      </div>
      {!isRead && (
        <span aria-label={t('unread')} className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} onClick={() => onOpen(id)} className={cn('flex items-start gap-3', LIST_ROW_CLASS)}>
        {body}
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg px-3 py-2.5">
      <div className="flex items-start gap-3">{body}</div>
      {kind === 'tradeOffer' && (
        <div className="flex items-center gap-2 pl-11">
          {response ? (
            <span className="type-caption text-hint">{t(response)}</span>
          ) : (
            <>
              <Button size="sm" onPress={() => onRespond(id, 'accepted')}>
                {t('accept')}
              </Button>
              <Button size="sm" variant="secondary" onPress={() => onRespond(id, 'declined')}>
                {t('decline')}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
