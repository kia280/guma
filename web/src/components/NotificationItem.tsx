'use client';

import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import React from 'react';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import type { GuildNotification, NotificationKind } from '@/types/notification';

const KIND_META: Record<NotificationKind, { icon: string; tint: string }> = {
  fundRequestApproved: { icon: 'solar:safe-2-linear', tint: 'bg-success/10 text-success' },
  fundRequestRejected: { icon: 'solar:safe-2-linear', tint: 'bg-danger/10 text-danger' },
  itemRequestApproved: { icon: 'solar:box-linear', tint: 'bg-success/10 text-success' },
  itemRequestRejected: { icon: 'solar:box-linear', tint: 'bg-danger/10 text-danger' },
  fundRequestSubmitted: { icon: 'solar:inbox-in-linear', tint: 'bg-accent/10 text-accent' },
  itemRequestSubmitted: { icon: 'solar:inbox-in-linear', tint: 'bg-accent/10 text-accent' },
  auctionOutbid: { icon: 'solar:sledgehammer-linear', tint: 'bg-danger/10 text-danger' },
  auctionWon: { icon: 'solar:cup-star-linear', tint: 'bg-success/10 text-success' },
  auctionSold: { icon: 'solar:sledgehammer-linear', tint: 'bg-success/10 text-success' },
  auctionUnsold: { icon: 'solar:sledgehammer-linear', tint: 'bg-default text-subtle' },
  itemReceived: { icon: 'solar:backpack-linear', tint: 'bg-accent/10 text-accent' },
  lootAssigned: { icon: 'solar:clipboard-check-linear', tint: 'bg-success/10 text-success' },
  lotteryWon: { icon: 'solar:ticket-linear', tint: 'bg-warning/10 text-warning' },
};

const FALLBACK_META = { icon: 'solar:bell-linear', tint: 'bg-default text-subtle' };

const isKnownKind = (type: string): type is NotificationKind => Object.prototype.hasOwnProperty.call(KIND_META, type);

const textParam = (value: string | number | undefined) =>
  typeof value === 'string' ? value.trim() : '';

export type NotificationItemProps = {
  notification: GuildNotification;
  onOpen: (id: string) => void;
};

export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const t = useTranslations('notificationItem');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const now = useNow({ updateInterval: 60 * 1000 });
  const { id, type, title, message, params, createdAt, isRead, href } = notification;
  const known = isKnownKind(type);
  const meta = known ? KIND_META[type] : FALLBACK_META;
  const note = textParam(params.note);
  const reason = textParam(params.reason);
  const amount = typeof params.amount === 'number' ? formatGold(params.amount) : params.amount;

  const body = (
    <>
      <div className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.tint)}>
        <Icon icon={meta.icon} width={16} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        {known ? (
          <p className={cn('type-body', isRead ? 'text-subtle' : 'text-foreground')}>
            {t.rich(type, {
              ...params,
              amount,
              b: chunks => <span className="font-medium text-foreground">{chunks}</span>,
            })}
          </p>
        ) : (
          <>
            <p className={cn('type-body font-medium', isRead ? 'text-subtle' : 'text-foreground')}>{title}</p>
            {message && <p className="type-body text-subtle">{message}</p>}
          </>
        )}
        {known && (note || reason) && (
          <p className="type-caption text-subtle line-clamp-2">
            {note ? t('note', { note }) : t('reason', { reason })}
          </p>
        )}
        <time dateTime={createdAt} className="type-caption text-hint">
          {format.relativeTime(new Date(createdAt), now)}
        </time>
      </div>
      {!isRead && (
        <>
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
          <span className="sr-only">{t('unread')}</span>
        </>
      )}
    </>
  );

  const rowClass = cn('flex w-full items-start gap-3 text-left', LIST_ROW_CLASS);

  if (href) {
    return (
      <Link href={href} onClick={() => onOpen(id)} className={rowClass}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onOpen(id)} className={rowClass}>
      {body}
    </button>
  );
}
