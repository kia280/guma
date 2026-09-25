'use client';

import React from 'react';
import { apiClient } from '@/lib/guma';
import type { BalancePoint } from '@/types/user';

export const BALANCE_TREND_DAYS = 30;

export type BalanceTrendStatus = 'loading' | 'error' | 'ready';

interface TrendState {
  key: string;
  points: BalancePoint[];
  failed: boolean;
}

const EMPTY_STATE: TrendState = { key: '', points: [], failed: false };

export function useBalanceTrend(guildId: string, days = BALANCE_TREND_DAYS) {
  const key = `${guildId}:${days}`;
  const [state, setState] = React.useState<TrendState>(EMPTY_STATE);
  const requestSeq = React.useRef(0);

  const refetch = React.useCallback(() => {
    const seq = ++requestSeq.current;
    apiClient
      .getBalanceTrend(guildId, days)
      .then(points => {
        if (seq === requestSeq.current) setState({ key, points, failed: false });
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setState(current => (current.key === key && !current.failed ? current : { key, points: [], failed: true }));
      });
  }, [guildId, days, key]);

  const retry = React.useCallback(() => {
    setState(EMPTY_STATE);
    refetch();
  }, [refetch]);

  React.useEffect(() => {
    const seq = requestSeq;
    refetch();
    return () => {
      seq.current++;
    };
  }, [refetch]);

  const isCurrent = state.key === key;
  const status: BalanceTrendStatus = !isCurrent ? 'loading' : state.failed ? 'error' : 'ready';

  return { points: isCurrent ? state.points : [], status, refetch, retry };
}
