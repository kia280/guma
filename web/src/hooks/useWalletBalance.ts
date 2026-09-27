'use client';

import React from 'react';
import { useUserStore } from '@/lib/store';

export function useWalletBalance() {
  const balance = useUserStore(s => s.user?.balance ?? 0);
  const isLoaded = useUserStore(s => s.user != null);
  const refreshMe = useUserStore(s => s.refreshMe);

  const refresh = React.useCallback(() => {
    void refreshMe();
  }, [refreshMe]);

  return { balance, isLoaded, refresh };
}
