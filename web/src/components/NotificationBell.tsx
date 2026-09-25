'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Popover } from '@heroui/react';
import { Icon } from '@iconify/react';

import { NotificationsCard } from './NotificationsCard';
import { useNotifications } from '@/hooks/useNotifications';

const MAX_BADGE_COUNT = 99;

export function NotificationBell() {
  const t = useTranslations('notificationsCard');
  const [isOpen, setIsOpen] = React.useState(false);
  const {
    filter,
    setFilter,
    notifications,
    unreadCount,
    status,
    hasMore,
    isLoadingMore,
    isMarkingAll,
    refresh,
    retry,
    loadMore,
    markRead,
    markAllRead,
  } = useNotifications();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) void refresh();
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        isIconOnly
        size="sm"
        aria-label={t('bellLabel', { count: unreadCount })}
        className="size-7 min-w-7 rounded-full text-subtle relative overflow-visible"
        variant="ghost"
      >
        <Icon icon="solar:bell-linear" width={18} aria-hidden />
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-0.5 text-danger-foreground text-[10px] font-bold tabular-nums"
          >
            {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
          </span>
        )}
      </Button>
      <Popover.Content className="w-[min(92vw,400px)] p-0">
        <Popover.Dialog className="p-0 m-0" aria-label={t('notifications')}>
          <NotificationsCard
            notifications={notifications}
            unreadCount={unreadCount}
            status={status}
            filter={filter}
            hasMore={hasMore}
            isLoadingMore={isLoadingMore}
            isMarkingAll={isMarkingAll}
            onFilterChange={setFilter}
            onOpen={id => void markRead(id)}
            onMarkAllRead={() => void markAllRead()}
            onLoadMore={() => void loadMore()}
            onRetry={retry}
            onNavigate={() => setIsOpen(false)}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
