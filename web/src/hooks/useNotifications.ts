'use client';

import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { apiClient } from '@/lib/guma';
import type { GuildNotification } from '@/types/notification';

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type NotificationFilter = 'all' | 'unread';
export type NotificationsStatus = 'loading' | 'ready' | 'error';

export function useNotifications() {
  const [filter, setFilterState] = React.useState<NotificationFilter>('all');
  const [notifications, setNotifications] = React.useState<GuildNotification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [nextPageToken, setNextPageToken] = React.useState<string>();
  const [status, setStatus] = React.useState<NotificationsStatus>('loading');
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isMarkingAll, setIsMarkingAll] = React.useState(false);
  const requestRef = React.useRef(0);
  const loadedRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const page = await apiClient.listNotifications({
        unreadOnly: filter === 'unread',
        pageSize: Math.min(Math.max(PAGE_SIZE, loadedRef.current), MAX_PAGE_SIZE),
      });
      if (request !== requestRef.current) return;
      loadedRef.current = page.notifications.length;
      setNotifications(page.notifications);
      setUnreadCount(page.unreadCount);
      setNextPageToken(page.nextPageToken);
      setStatus('ready');
    } catch {
      if (request !== requestRef.current) return;
      setStatus(current => (current === 'ready' ? current : 'error'));
    }
  }, [filter]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  useLiveResource(['notification'], () => void refresh());

  const setFilter = React.useCallback((next: NotificationFilter) => {
    loadedRef.current = 0;
    setStatus('loading');
    setFilterState(next);
  }, []);

  const retry = React.useCallback(() => {
    setStatus('loading');
    void refresh();
  }, [refresh]);

  const loadMore = React.useCallback(async () => {
    if (!nextPageToken) return;
    const request = requestRef.current;
    setIsLoadingMore(true);
    try {
      const page = await apiClient.listNotifications({
        unreadOnly: filter === 'unread',
        pageSize: PAGE_SIZE,
        pageToken: nextPageToken,
      });
      if (request !== requestRef.current) return;
      setNotifications(current => {
        const seen = new Set(current.map(n => n.id));
        const merged = [...current, ...page.notifications.filter(n => !seen.has(n.id))];
        loadedRef.current = merged.length;
        return merged;
      });
      setUnreadCount(page.unreadCount);
      setNextPageToken(page.nextPageToken);
    } catch {
      void refresh();
    } finally {
      setIsLoadingMore(false);
    }
  }, [filter, nextPageToken, refresh]);

  const markRead = React.useCallback(
    async (id: string) => {
      const target = notifications.find(n => n.id === id);
      if (!target || target.isRead) return;
      setNotifications(current => current.map(n => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount(count => Math.max(0, count - 1));
      try {
        await apiClient.markNotificationRead(id);
      } catch {
        void refresh();
      }
    },
    [notifications, refresh],
  );

  const markAllRead = React.useCallback(async () => {
    setIsMarkingAll(true);
    try {
      await apiClient.markAllNotificationsRead();
      if (filter === 'unread') {
        loadedRef.current = 0;
        setNotifications([]);
        setNextPageToken(undefined);
      } else {
        setNotifications(current => current.map(n => ({ ...n, isRead: true })));
      }
      setUnreadCount(0);
    } catch {
      void refresh();
    } finally {
      setIsMarkingAll(false);
    }
  }, [filter, refresh]);

  return {
    filter,
    setFilter,
    notifications,
    unreadCount,
    status,
    hasMore: Boolean(nextPageToken),
    isLoadingMore,
    isMarkingAll,
    refresh,
    retry,
    loadMore,
    markRead,
    markAllRead,
  };
}
