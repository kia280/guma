'use client';

import { Button, Chip, ScrollShadow, Spinner, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import type { NotificationFilter, NotificationsStatus } from '@/hooks/useNotifications';
import type { GuildNotification } from '@/types/notification';
import { NotificationItem } from './NotificationItem';

export type NotificationsCardProps = {
  notifications: GuildNotification[];
  unreadCount: number;
  status: NotificationsStatus;
  filter: NotificationFilter;
  hasMore: boolean;
  isLoadingMore: boolean;
  isMarkingAll: boolean;
  onFilterChange: (filter: NotificationFilter) => void;
  onOpen: (id: string) => void;
  onMarkAllRead: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onNavigate: () => void;
};

export function NotificationsCard({
  notifications,
  unreadCount,
  status,
  filter,
  hasMore,
  isLoadingMore,
  isMarkingAll,
  onFilterChange,
  onOpen,
  onMarkAllRead,
  onLoadMore,
  onRetry,
  onNavigate,
}: NotificationsCardProps) {
  const t = useTranslations('notificationsCard');

  const handleOpen = (id: string) => {
    onOpen(id);
    if (notifications.find(n => n.id === id)?.href) onNavigate();
  };

  let content: React.ReactNode;
  if (status === 'loading') {
    content = (
      <div className="flex items-center justify-center py-12">
        <Spinner aria-label={t('loading')} />
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12">
        <Icon className="text-danger" icon="solar:danger-circle-linear" width={32} aria-hidden />
        <p className="type-body text-subtle">{t('loadError')}</p>
        <Button size="sm" variant="secondary" onPress={onRetry}>
          <Icon icon="solar:restart-linear" width={16} aria-hidden />
          {t('retry')}
        </Button>
      </div>
    );
  } else if (notifications.length === 0) {
    content = (
      <EmptyContent
        size="sm"
        icon="solar:bell-off-linear"
        title={filter === 'unread' ? t('allCaughtUp') : t('noNotifications')}
      />
    );
  } else {
    content = (
      <>
        <ul className="flex flex-col gap-0.5 p-1.5">
          {notifications.map(notification => (
            <li key={notification.id}>
              <NotificationItem notification={notification} onOpen={handleOpen} />
            </li>
          ))}
        </ul>
        {hasMore && (
          <div className="flex justify-center px-1.5 pb-1.5">
            <Button size="sm" variant="ghost" isPending={isLoadingMore} onPress={onLoadMore}>
              {({ isPending }) => (
                <>
                  {isPending && <Spinner color="current" size="sm" />}
                  {t('loadMore')}
                </>
              )}
            </Button>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="type-subheading text-foreground">{t('notifications')}</h2>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={unreadCount === 0}
          isPending={isMarkingAll}
          onPress={onMarkAllRead}
        >
          {({ isPending }) => (
            <>
              {isPending ? (
                <Spinner color="current" size="sm" />
              ) : (
                <Icon icon="solar:check-read-linear" width={16} aria-hidden />
              )}
              {t('markAllRead')}
            </>
          )}
        </Button>
      </div>

      <Tabs
        variant="secondary"
        selectedKey={filter}
        onSelectionChange={key => onFilterChange(key as NotificationFilter)}
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

      <ScrollShadow className="max-h-[420px] border-t border-divider" aria-busy={status === 'loading'}>
        {content}
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
