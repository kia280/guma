'use client';

import React from 'react';
import { Avatar, Badge, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { cn } from '@heroui/react';
import { useTranslations } from 'next-intl';

export type NotificationType = 'default' | 'request' | 'file';

export type NotificationItem = {
  id: string;
  isRead?: boolean;
  avatar: string;
  description: string;
  name: string;
  time: string;
  type?: NotificationType;
};

export type NotificationItemProps = React.HTMLAttributes<HTMLDivElement> & NotificationItem;

const NotificationItem = React.forwardRef<HTMLDivElement, NotificationItemProps>(
  ({ children, avatar, name, description, type, time, isRead, className, ...props }, ref) => {
    const t = useTranslations('notificationItem');
    /**
     * Defines the content for different types of notifications.
     */
    const contentByType: Record<NotificationType, React.ReactNode> = {
      default: null,
      request: (
        <div className="flex gap-2 pt-2">
          <Button size="sm">{t('accept')}</Button>
          <Button size="sm" variant="secondary">
            {t('decline')}
          </Button>
        </div>
      ),
      file: (
        <div className="flex items-center gap-2">
          <Icon className="text-secondary" icon="solar:figma-file-linear" width={30} />
          <div className="flex flex-col">
            <strong className="type-body font-medium">Brand_Logo_v1.2.fig</strong>
            <p className="type-caption text-hint">3.4 MB</p>
          </div>
        </div>
      ),
    };

    return (
      <div
        ref={ref}
        className={cn(
          'border-divider flex gap-3 border-b px-6 py-4',
          {
            'bg-accent/5': !isRead,
          },
          className
        )}
        {...props}
      >
        <div className="relative flex-none">
          <Badge.Anchor>
            <Avatar>
              <Avatar.Image src={avatar} alt={name} />
              <Avatar.Fallback>{name?.slice(0, 2).toUpperCase()}</Avatar.Fallback>
            </Avatar>
            {!isRead && <Badge color="danger" placement="bottom-right" size="sm" />}
          </Badge.Anchor>
        </div>
        <div className="flex flex-col gap-1">
          <p className="type-body text-foreground">
            <strong className="font-medium">{name}</strong> {description || children}
          </p>
          <time className="type-caption text-hint">{time}</time>
          {type && contentByType[type]}
        </div>
      </div>
    );
  }
);

NotificationItem.displayName = 'NotificationItem';

export { NotificationItem };
