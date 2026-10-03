'use client';

import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import type { RollCall } from '@/types/roll-call';

export function useRollCalls(guildId: string) {
  const [rollCalls, setRollCalls] = React.useState<RollCall[]>([]);
  const { state, ready, failed, reset } = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    reset();
    setReloadKey(key => key + 1);
  }, [reset]);
  const refetch = React.useCallback(() => {
    apiClient
      .listRollCalls(guildId)
      .then(data => {
        setRollCalls(data);
        ready();
      })
      .catch(() => {
        failed();
        notify.loadFailed(reload, 'rollCalls');
      });
  }, [guildId, notify, reload, ready, failed]);
  React.useEffect(() => {
    refetch();
  }, [refetch, reloadKey]);
  useLiveResource(['rollCall'], refetch, { guildId });

  return { rollCalls, state, reload, refetch };
}
