'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, Popover } from '@heroui/react';
import { Icon } from '@iconify/react';

import { NotificationsCard } from './NotificationsCard';
import { mockNotifications } from '@/lib/guma/mock/data';
import { localizeMock } from '@/lib/guma/mock/i18n';
import { isLocale } from '@/i18n/locales';
import type { GuildNotification, TradeResponse } from '@/types/notification';

export function NotificationBell() {
  const t = useTranslations('notificationsCard');
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<GuildNotification[]>(mockNotifications);

  const locale = useLocale();
  const localized = React.useMemo(
    () => (isLocale(locale) ? localizeMock(notifications, locale) : notifications),
    [notifications, locale]
  );

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = (id: string) =>
    setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)));

  const respond = (id: string, response: TradeResponse) =>
    setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: true, response } : n)));

  const markAllRead = () => setNotifications(list => list.map(n => ({ ...n, isRead: true })));

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        isIconOnly
        size="lg"
        aria-label={t('bellLabel', { count: unreadCount })}
        className="rounded-full text-subtle relative overflow-visible"
        variant="ghost"
      >
        <Icon icon="solar:bell-linear" width={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-0.5 text-danger-foreground text-[11px] font-bold tabular-nums">
            {unreadCount}
          </span>
        )}
      </Button>
      <Popover.Content className="w-[min(92vw,400px)] p-0">
        <Popover.Dialog className="p-0 m-0">
          <NotificationsCard
            notifications={localized}
            onOpen={markRead}
            onRespond={respond}
            onMarkAllRead={markAllRead}
            onNavigate={() => setIsOpen(false)}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
