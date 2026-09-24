'use client';

import React from 'react';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';

export function useWalletBalance() {
  const guildId = useCurrentGuildId();
  const [balance, setBalance] = React.useState(0);

  const refresh = React.useCallback(() => {
    apiClient
      .getWallet(guildId)
      .then(wallet => setBalance(wallet.balance))
      .catch(() => setBalance(0));
  }, [guildId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, refresh };
}
