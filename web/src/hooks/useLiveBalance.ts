'use client';

import React from 'react';
import { onApiMutation } from '@/lib/guma';
import { isLiveStreamOpen, subscribeLiveEvents } from '@/lib/live-events';
import { useUserStore } from '@/lib/store';

const FALLBACK_POLL_INTERVAL_MS = 15_000;

export function useLiveBalance() {
  const refreshMe = useUserStore(s => s.refreshMe);
  const applyWalletUpdate = useUserStore(s => s.applyWalletUpdate);

  React.useEffect(() => {
    const refreshIfVisible = () => {
      if (!isLiveStreamOpen() && document.visibilityState === 'visible') void refreshMe();
    };

    const unsubscribeLive = subscribeLiveEvents(event => {
      if (event.kind === 'open') void refreshMe();
      if (event.kind === 'wallet') applyWalletUpdate(event.guildId, event.balance);
    });
    const poll = window.setInterval(refreshIfVisible, FALLBACK_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const unsubscribeMutations = onApiMutation(() => {
      if (!isLiveStreamOpen()) void refreshMe();
    });

    return () => {
      unsubscribeLive();
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      unsubscribeMutations();
    };
  }, [refreshMe, applyWalletUpdate]);
}
