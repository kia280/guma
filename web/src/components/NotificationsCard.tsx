'use client';

import type { CardProps } from '@heroui/react';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, Chip, Tabs, ScrollShadow } from '@heroui/react';
import { Icon } from '@iconify/react';

import { NotificationItem } from './NotificationItem';

type Notification = {
  id: string;
  isRead?: boolean;
  avatar: string;
  description: string;
  name: string;
  time: string;
  type?: 'default' | 'request' | 'file';
};

enum NotificationTabs {
  All = 'all',
  Unread = 'unread',
  Archive = 'archive',
}

const notifications: Record<NotificationTabs, Notification[]> = {
  all: [
    {
      id: '1',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a04258114e29026708c',
      description: 'requested to join your Acme organization.',
      name: 'Tony Reichert',
      time: '2 hours ago',
      type: 'request',
    },
    {
      id: '2',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
      description: 'modified the Brand logo file.',
      name: 'Ben Berman',
      time: '7 hours ago',
      type: 'file',
    },
    {
      id: '3',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
      description: 'liked your post.',
      name: 'Jane Doe',
      time: 'Yesterday',
    },
    {
      id: '4',
      isRead: true,
      avatar: 'https://i.pravatar.cc/150?u=a04258a2462d826712d',
      description: 'started following you.',
      name: 'John Smith',
      time: 'Yesterday',
    },
    {
      id: '5',
      isRead: true,
      avatar: 'https://i.pravatar.cc/150?u=a04258a24a2d826712d',
      description: 'mentioned you in a post.',
      name: 'Jacob Jones',
      time: '2 days ago',
    },
    {
      id: '6',
      isRead: true,
      avatar: 'https://i.pravatar.cc/150?u=a04458a24a2d826712d',
      description: 'commented on your post.',
      name: 'Amelie Dawson',
      time: '4 days ago',
    },
  ],
  unread: [
    {
      id: '1',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a04258114e29026708c',
      description: 'requested to join your Acme organization.',
      name: 'Tony Reichert',
      time: '2 hours ago',
      type: 'request',
    },
    {
      id: '2',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
      description: 'modified the Brand logo file.',
      name: 'Ben Berman',
      time: '7 hours ago',
      type: 'file',
    },
    {
      id: '3',
      isRead: false,
      avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
      description: 'liked your post.',
      name: 'Jane Doe',
      time: 'Yesterday',
    },
  ],
  archive: [],
};

export function NotificationsCard(props: CardProps) {
  const t = useTranslations('notificationsCard');
  const [activeTab, setActiveTab] = React.useState<NotificationTabs>(NotificationTabs.All);

  const activeNotifications = notifications[activeTab];

  return (
    <Card className="w-full max-w-[420px]" {...props}>
      <Card.Header className="flex flex-col px-0 pb-0">
        <div className="flex w-full items-center justify-between px-5 py-2">
          <div className="inline-flex items-center gap-1">
            <h4 className="text-large inline-block align-middle font-medium">
              {t('notifications')}
            </h4>
            <Chip size="sm" variant="secondary">
              9
            </Chip>
          </div>
          <Button className="h-8 px-3" variant="ghost">
            {t('markAllRead')}
          </Button>
        </div>
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={key => setActiveTab(key as NotificationTabs)}
          className="w-full"
        >
          <Tabs.ListContainer>
            <Tabs.List
              aria-label="Notifications"
              className="gap-6 px-6 py-0 w-full relative rounded-none border-b border-divider"
            >
              <Tabs.Tab id={NotificationTabs.All} className="max-w-fit px-2 h-12">
                <div className="flex items-center space-x-2">
                  <span>{t('all')}</span>
                  <Chip size="sm" variant="secondary">
                    9
                  </Chip>
                </div>
              </Tabs.Tab>
              <Tabs.Tab id={NotificationTabs.Unread} className="max-w-fit px-2 h-12">
                <div className="flex items-center space-x-2">
                  <span>{t('unread')}</span>
                  <Chip size="sm" variant="secondary">
                    3
                  </Chip>
                </div>
              </Tabs.Tab>
              <Tabs.Tab id={NotificationTabs.Archive} className="max-w-fit px-2 h-12">
                {t('archive')}
              </Tabs.Tab>
              <Tabs.Indicator />
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </Card.Header>
      <Card.Content className="w-full gap-0 p-0">
        <ScrollShadow className="max-h-[400px] w-full">
          {activeNotifications?.length > 0 ? (
            activeNotifications.map(notification => (
              <NotificationItem key={notification.id} {...notification} />
            ))
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2">
              <Icon className="text-foreground/40" icon="solar:bell-off-linear" width={40} />
              <p className="text-small text-foreground/40">{t('noNotifications')}</p>
            </div>
          )}
        </ScrollShadow>
      </Card.Content>
      <Card.Footer className="justify-end gap-2 px-4 flex flex-row">
        <Button variant="secondary">
          {t('settings')}
        </Button>
        {activeTab !== NotificationTabs.Archive && (
          <Button variant="tertiary">{t('archiveAll')}</Button>
        )}
      </Card.Footer>
    </Card>
  );
}
