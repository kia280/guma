'use client';

import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';

export type WalletAction = 'deposit' | 'transfer' | 'withdraw' | 'withdrawItem';

type RunOptions = {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
};

export function useWalletAction(action: WalletAction, onCompleted: () => void) {
  const t = useTranslations('walletPage');
  const notify = useToast();
  const [isPending, setIsPending] = React.useState(false);
  const [completed, setCompleted] = React.useState<{ detail: string } | null>(null);

  const run = async (request: () => Promise<unknown>, detail: string, { onSuccess, onError }: RunOptions = {}) => {
    setIsPending(true);
    try {
      await request();
      onCompleted();
      onSuccess?.();
      setCompleted({ detail });
    } catch (err) {
      if (onError) onError(err);
      else notify.error(t(`${action}Failed`));
    } finally {
      setIsPending(false);
    }
  };

  const reset = React.useCallback(() => setCompleted(null), []);

  return { isPending, completed, run, reset };
}

export type WalletActionHandle = ReturnType<typeof useWalletAction>;
