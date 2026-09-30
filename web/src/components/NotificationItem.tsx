'use client';

import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useNow, useTranslations } from 'next-intl';
import React from 'react';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import { isGuildRole } from '@/lib/permissions';
import type { GuildNotification, NotificationKind } from '@/types/notification';

const KIND_META: Record<NotificationKind, { icon: string; tint: string }> = {
  fundRequestApproved: { icon: 'solar:safe-2-linear', tint: 'bg-success/10 text-success' },
  fundRequestRejected: { icon: 'solar:safe-2-linear', tint: 'bg-danger/10 text-danger' },
  itemRequestApproved: { icon: 'solar:box-linear', tint: 'bg-success/10 text-success' },
  itemRequestRejected: { icon: 'solar:box-linear', tint: 'bg-danger/10 text-danger' },
  fundRequestSubmitted: { icon: 'solar:inbox-in-linear', tint: 'bg-accent/10 text-accent' },
  itemRequestSubmitted: { icon: 'solar:inbox-in-linear', tint: 'bg-accent/10 text-accent' },
  withdrawalRequestSubmitted: { icon: 'solar:inbox-in-linear', tint: 'bg-accent/10 text-accent' },
  withdrawalRequestApproved: { icon: 'solar:arrow-up-linear', tint: 'bg-success/10 text-success' },
  withdrawalRequestRejected: { icon: 'solar:arrow-up-linear', tint: 'bg-danger/10 text-danger' },
  auctionOutbid: { icon: 'solar:sledgehammer-linear', tint: 'bg-danger/10 text-danger' },
  auctionWon: { icon: 'solar:cup-star-linear', tint: 'bg-success/10 text-success' },
  auctionSold: { icon: 'solar:sledgehammer-linear', tint: 'bg-success/10 text-success' },
  auctionUnsold: { icon: 'solar:sledgehammer-linear', tint: 'bg-default text-subtle' },
  auctionCancelled: { icon: 'solar:forbidden-circle-linear', tint: 'bg-default text-subtle' },
  itemReceived: { icon: 'solar:backpack-linear', tint: 'bg-accent/10 text-accent' },
  goldReceived: { icon: 'solar:hand-money-linear', tint: 'bg-success/10 text-success' },
  itemMovedByAdmin: { icon: 'solar:shield-user-linear', tint: 'bg-warning/10 text-warning' },
  itemDelivered: { icon: 'solar:box-minimalistic-linear', tint: 'bg-success/10 text-success' },
  lootAssigned: { icon: 'solar:clipboard-check-linear', tint: 'bg-success/10 text-success' },
  rollCallGoldReceived: { icon: 'solar:hand-money-linear', tint: 'bg-success/10 text-success' },
  raffleWon: { icon: 'solar:ticket-linear', tint: 'bg-warning/10 text-warning' },
  raffleCancelled: { icon: 'solar:forbidden-circle-linear', tint: 'bg-default text-subtle' },
  memberRoleChanged: { icon: 'solar:shield-user-linear', tint: 'bg-accent/10 text-accent' },
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
  const roleLabels = useTranslations('adminPage.roles');
  const userName = useUserName();
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const now = useNow({ updateInterval: 60 * 1000 });
  const { id, type, title, message, params, createdAt, isRead, href } = notification;
  const known = isKnownKind(type);
  const meta = known ? KIND_META[type] : FALLBACK_META;
  const note = textParam(params.note);
  const reason = textParam(params.reason);
  const amount = typeof params.amount === 'number' ? formatGold(params.amount) : params.amount;
  const roleParam = (value: string | number | undefined) => {
    const role = textParam(value);
    return isGuildRole(role) ? roleLabels(role) : role;
  };

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
              actor: userName(textParam(params.actor)),
              from: userName(textParam(params.from)),
              amount,
              oldRole: roleParam(params.oldRole),
              newRole: roleParam(params.newRole),
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
