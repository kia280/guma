'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button, Chip, ScrollShadow, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';

import { NotificationItem } from './NotificationItem';
import type { GuildNotification, TradeResponse } from '@/types/notification';

type NotificationFilter = 'all' | 'unread';

export type NotificationsCardProps = {
  notifications: GuildNotification[];
  onOpen: (id: string) => void;
  onRespond: (id: string, response: TradeResponse) => void;
  onMarkAllRead: () => void;
  onNavigate: () => void;
};

export function NotificationsCard({
  notifications,
  onOpen,
  onRespond,
  onMarkAllRead,
  onNavigate,
}: NotificationsCardProps) {
  const t = useTranslations('notificationsCard');
  const [filter, setFilter] = React.useState<NotificationFilter>('all');

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const visible = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;

  const handleOpen = (id: string) => {
    onOpen(id);
    onNavigate();
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="type-subheading text-foreground">{t('notifications')}</h2>
        <Button size="sm" variant="ghost" isDisabled={unreadCount === 0} onPress={onMarkAllRead}>
          <Icon icon="solar:check-read-linear" width={16} />
          {t('markAllRead')}
        </Button>
      </div>

      <Tabs
        variant="secondary"
        selectedKey={filter}
        onSelectionChange={key => setFilter(key as NotificationFilter)}
        className="px-2"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('notifications')}>
            <Tabs.Tab id="all">
              {t('all')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="unread">
              <span className="flex items-center gap-1.5">
                {t('unread')}
                {unreadCount > 0 && (
                  <Chip size="sm" color="accent" variant="secondary" className="tabular-nums">
                    {unreadCount}
                  </Chip>
                )}
              </span>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <ScrollShadow className="max-h-[420px] border-t border-divider">
        {visible.length > 0 ? (
          <ul className="flex flex-col gap-0.5 p-1.5">
            {visible.map(notification => (
              <li key={notification.id}>
                <NotificationItem notification={notification} onOpen={handleOpen} onRespond={onRespond} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Icon className="text-disabled" icon="solar:bell-off-linear" width={32} />
            <p className="type-body text-subtle">
              {filter === 'unread' ? t('allCaughtUp') : t('noNotifications')}
            </p>
          </div>
        )}
      </ScrollShadow>

      <div className="flex justify-center border-t border-divider p-1.5">
        <Link
          href="/dashboard/preference"
          onClick={onNavigate}
          className="type-label text-subtle rounded-lg px-3 py-2 transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {t('settings')}
        </Link>
      </div>
    </div>
  );
}
