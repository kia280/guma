'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBalanceTrend } from '@/hooks/useBalanceTrend';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { subscribeLiveEvents, type LiveResource } from '@/lib/live-events';
import { useUserStore } from '@/lib/store';
import type { DashboardData } from '@/types/dashboard';

const LIVE_DASHBOARD_RESOURCES: readonly LiveResource[] = ['bank', 'auction', 'raffle', 'rollCall', 'announcement'];
const LIVE_REFETCH_DEBOUNCE_MS = 250;

export function useDashboardData(guildId: string) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const balanceTrend = useBalanceTrend(guildId);
  const refetchTrend = balanceTrend.refetch;
  const { state, ready, failed, reset } = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => {
    reset();
    setReloadKey(key => key + 1);
  }, [reset]);
  const requestSeq = useRef(0);
  const refetchDashboard = useCallback(() => {
    const seq = ++requestSeq.current;
    apiClient
      .getDashboardData(guildId)
      .then(d => {
        if (seq !== requestSeq.current) return;
        setDashboard(d);
        ready();
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        failed();
        notify.loadFailed(reload, 'dashboard');
      });
  }, [guildId, notify, reload, ready, failed]);

  useEffect(() => {
    refetchDashboard();
    return () => { requestSeq.current++; };
  }, [refetchDashboard, reloadKey]);

  useLiveResource(LIVE_DASHBOARD_RESOURCES, refetchDashboard, { guildId });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeLiveEvents(event => {
      if (event.kind !== 'wallet' || event.guildId !== guildId) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        refetchDashboard();
        refetchTrend();
      }, LIVE_REFETCH_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [guildId, refetchDashboard, refetchTrend]);

  const liveBalance = useUserStore(s =>
    s.user && s.user.currentGuildId === guildId ? s.user.balance : undefined,
  );

  const guildStats = dashboard?.guildStats ?? {
    members: 0, activeEvents: 0, balance: 0, attendanceThisWeek: 0, activeAuctions: 0, openRaffles: 0,
  };
  const fetchedPersonalStats = dashboard?.personalStats ?? {
    balance: 0, attendanceThisMonth: 0, activeAuctions: 0, activityPoints: 0,
  };
  const personalStats = liveBalance === undefined
    ? fetchedPersonalStats
    : { ...fetchedPersonalStats, balance: liveBalance };

  return {
    state,
    reload,
    balanceTrend,
    guildStats,
    personalStats,
    announcements: dashboard?.announcements ?? [],
    incomingEvents: dashboard?.incomingEvents ?? [],
  };
}
