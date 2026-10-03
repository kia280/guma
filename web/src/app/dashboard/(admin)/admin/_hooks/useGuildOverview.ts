'use client';

import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { apiClient } from '@/lib/guma';
import type { AdminActivity, AdminGuildStats } from '@/types/admin';
import type { FetchStatus } from './useAdminData';

export function useGuildOverview(guildId: string) {
  const [recentActivity, setRecentActivity] = React.useState<AdminActivity[]>([]);
  const [activityStatus, setActivityStatus] = React.useState<FetchStatus>('loading');
  const [activityReloadKey, setActivityReloadKey] = React.useState(0);
  const [guildStats, setGuildStats] = React.useState<AdminGuildStats | null>(null);
  const [statsStatus, setStatsStatus] = React.useState<FetchStatus>('loading');
  const [statsReloadKey, setStatsReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getAdminActivity()
      .then(d => {
        if (cancelled) return;
        setRecentActivity(d);
        setActivityStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setActivityStatus('error');
      });
    return () => { cancelled = true; };
  }, [guildId, activityReloadKey]);

  const retryActivity = () => {
    setActivityStatus('loading');
    setActivityReloadKey(key => key + 1);
  };

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getGuildStats(guildId)
      .then(d => {
        if (cancelled) return;
        setGuildStats(d);
        setStatsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatsStatus('error');
      });
    return () => { cancelled = true; };
  }, [guildId, statsReloadKey]);

  const retryStats = () => {
    setStatsStatus('loading');
    setStatsReloadKey(key => key + 1);
  };

  const refetchStats = React.useCallback(() => {
    apiClient.getGuildStats(guildId).then(d => {
      setGuildStats(d);
      setStatsStatus('ready');
    }).catch(() => {});
  }, [guildId]);

  useLiveResource(['bank'], refetchStats, { guildId });

  return { recentActivity, activityStatus, retryActivity, guildStats, statsStatus, retryStats };
}

export type GuildOverview = ReturnType<typeof useGuildOverview>;
