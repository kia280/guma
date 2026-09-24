'use client';

import React from 'react';
import { onApiMutation } from '@/lib/guma';
import { useUserStore } from '@/lib/store';

const POLL_INTERVAL_MS = 15_000;

export function useLiveBalance() {
  const refreshMe = useUserStore(s => s.refreshMe);

  React.useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refreshMe();
    };

    const interval = window.setInterval(refreshIfVisible, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    const unsubscribe = onApiMutation(() => void refreshMe());

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      unsubscribe();
    };
  }, [refreshMe]);
}
