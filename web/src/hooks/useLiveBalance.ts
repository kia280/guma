'use client';

import React from 'react';
import { env } from '@/lib/env';
import { isDevMockEnabled } from '@/lib/dev-mock';
import { onApiMutation } from '@/lib/guma';
import { useUserStore } from '@/lib/store';

const FALLBACK_POLL_INTERVAL_MS = 15_000;
const RECONNECT_DELAY_MS = 30_000;

type UserEventMessage = {
  result?: {
    wallet_updated?: { guild_id?: string; balance?: string | number };
  };
};

const parseWalletUpdate = (data: string) => {
  try {
    const update = (JSON.parse(data) as UserEventMessage).result?.wallet_updated;
    if (!update?.guild_id) return null;
    return { guildId: update.guild_id, balance: Number(update.balance ?? 0) };
  } catch {
    return null;
  }
};

export function useLiveBalance() {
  const refreshMe = useUserStore(s => s.refreshMe);
  const applyWalletUpdate = useUserStore(s => s.applyWalletUpdate);

  React.useEffect(() => {
    let source: EventSource | null = null;
    let streamOpen = false;
    let reconnectTimer: number | undefined;

    const refreshIfVisible = () => {
      if (!streamOpen && document.visibilityState === 'visible') void refreshMe();
    };

    const connect = () => {
      if (env.useMock || isDevMockEnabled()) return;
      source = new EventSource(new URL('/v1/me/events', env.api.url), { withCredentials: true });
      source.onopen = () => {
        streamOpen = true;
        void refreshMe();
      };
      source.onmessage = event => {
        const update = parseWalletUpdate(event.data);
        if (update) applyWalletUpdate(update.guildId, update.balance);
      };
      source.onerror = () => {
        streamOpen = false;
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    };

    connect();
    const poll = window.setInterval(refreshIfVisible, FALLBACK_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const unsubscribe = onApiMutation(() => {
      if (!streamOpen) void refreshMe();
    });

    return () => {
      source?.close();
      window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      unsubscribe();
    };
  }, [refreshMe, applyWalletUpdate]);
}
