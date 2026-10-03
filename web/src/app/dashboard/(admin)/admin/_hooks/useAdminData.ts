'use client';

import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import type { AdminAnnouncement } from '@/types/admin';
import type { MockUser } from '@/types/user';
import type { MemberAssetSummary } from '@/types/wallet';

export type FetchStatus = 'loading' | 'ready' | 'error';

export function useAdminData(guildId: string, canManageAssets: boolean) {
  const notify = useToast();
  const [members, setMembers] = React.useState<MockUser[]>([]);
  const [memberAssets, setMemberAssets] = React.useState<Map<string, MemberAssetSummary>>(() => new Map());
  const [assetsStatus, setAssetsStatus] = React.useState<FetchStatus>('loading');
  const [assetsReloadKey, setAssetsReloadKey] = React.useState(0);
  const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([]);
  const { state: usersState, ready: usersReady, failed: usersFailed, reset: resetUsers } = useLoadState();
  const {
    state: announcementsState,
    ready: announcementsReady,
    failed: announcementsFailed,
    reset: resetAnnouncements,
  } = useLoadState();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    resetUsers();
    resetAnnouncements();
    setReloadKey(key => key + 1);
  }, [resetUsers, resetAnnouncements]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .listMembers(guildId)
      .then(d => {
        if (cancelled) return;
        setMembers(d);
        usersReady();
      })
      .catch(() => {
        if (cancelled) return;
        usersFailed();
        notify.loadFailed(reload, 'admin');
      });
    apiClient
      .getAdminAnnouncements(guildId)
      .then(d => {
        if (cancelled) return;
        setAnnouncements(d);
        announcementsReady();
      })
      .catch(() => {
        if (cancelled) return;
        announcementsFailed();
        notify.loadFailed(reload, 'admin');
      });
    return () => { cancelled = true; };
  }, [guildId, reloadKey, notify, reload, usersReady, usersFailed, announcementsReady, announcementsFailed]);

  React.useEffect(() => {
    if (!canManageAssets) return;
    let cancelled = false;
    apiClient
      .listMemberAssets(guildId)
      .then(summaries => {
        if (cancelled) return;
        setMemberAssets(new Map(summaries.map(summary => [summary.userId, summary])));
        setAssetsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setAssetsStatus('error');
      });
    return () => { cancelled = true; };
  }, [guildId, canManageAssets, assetsReloadKey, reloadKey]);

  const refetchAssets = React.useCallback(() => setAssetsReloadKey(key => key + 1), []);

  const applyRoleChange = React.useCallback((updated: MockUser) => {
    setMembers(prev => prev.map(member => (member.id === updated.id ? { ...member, role: updated.role } : member)));
  }, []);

  const refetchMembers = React.useCallback(() => {
    apiClient.listMembers(guildId).then(setMembers).catch(() => {});
  }, [guildId]);

  useLiveResource(['member'], refetchMembers, { guildId });

  const refetchAnnouncements = React.useCallback(() => {
    apiClient
      .getAdminAnnouncements(guildId)
      .then(setAnnouncements)
      .catch(() => notify.loadFailed(reload, 'admin'));
  }, [guildId, notify, reload]);

  useLiveResource(['announcement'], refetchAnnouncements, { guildId });

  const removeAnnouncement = React.useCallback((id: string) => {
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  }, []);

  return {
    members,
    memberAssets,
    assetsStatus,
    announcements,
    usersState,
    announcementsState,
    reload,
    refetchAssets,
    refetchMembers,
    applyRoleChange,
    refetchAnnouncements,
    removeAnnouncement,
  };
}
