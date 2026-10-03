'use client';

import React from 'react';
import { useBalanceTrend } from '@/hooks/useBalanceTrend';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { subscribeLiveEvents, type LiveResource } from '@/lib/live-events';
import type { BackpackItem } from '@/types/backpack';
import type { MockUser } from '@/types/user';
import type { Transaction, Wallet, WithdrawalRequest } from '@/types/wallet';

const LIVE_WITHDRAWAL_RESOURCES: readonly LiveResource[] = ['withdrawal'];
const LIVE_BACKPACK_RESOURCES: readonly LiveResource[] = ['bank', 'auction', 'raffle', 'backpack'];
const LIVE_REFETCH_DEBOUNCE_MS = 250;

export function useWalletData(guildId: string) {
  const notify = useToast();
  const balanceTrend = useBalanceTrend(guildId);
  const [wallet, setWallet] = React.useState<Wallet | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [backpackItems, setBackpackItems] = React.useState<BackpackItem[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = React.useState<WithdrawalRequest[]>([]);
  const [members, setMembers] = React.useState<MockUser[]>([]);
  const { state: walletState, ready: walletReady, failed: walletFailed, reset: resetWallet } = useLoadState();
  const {
    state: transactionsState,
    ready: transactionsReady,
    failed: transactionsFailed,
    reset: resetTransactions,
  } = useLoadState();
  const { state: backpackState, ready: backpackReady, failed: backpackFailed, reset: resetBackpack } = useLoadState();
  const [reloadKey, setReloadKey] = React.useState(0);

  const reload = React.useCallback(() => {
    resetWallet();
    resetTransactions();
    resetBackpack();
    setReloadKey(key => key + 1);
  }, [resetWallet, resetTransactions, resetBackpack]);

  const refetchTrend = balanceTrend.refetch;
  const refetchBalance = React.useCallback(() => {
    apiClient
      .getWallet(guildId)
      .then(data => {
        setWallet(data);
        walletReady();
      })
      .catch(() => {
        walletFailed();
        notify.loadFailed(reload, 'wallet');
      });
    apiClient
      .listTransactions(guildId)
      .then(data => {
        setTransactions(data);
        transactionsReady();
      })
      .catch(() => {
        transactionsFailed();
        notify.loadFailed(reload, 'wallet');
      });
    apiClient
      .listMyWithdrawalRequests(guildId, 'pending')
      .then(setPendingWithdrawals)
      .catch(() => notify.loadFailed(reload, 'wallet'));
    refetchTrend();
  }, [guildId, refetchTrend, notify, reload, walletReady, walletFailed, transactionsReady, transactionsFailed]);

  const refetchBackpack = React.useCallback(() => {
    apiClient
      .listBackpack(guildId)
      .then(data => {
        setBackpackItems(data);
        backpackReady();
      })
      .catch(() => {
        backpackFailed();
        notify.loadFailed(reload, 'wallet');
      });
  }, [guildId, notify, reload, backpackReady, backpackFailed]);

  const refetchWallet = React.useCallback(() => {
    refetchBalance();
    refetchBackpack();
  }, [refetchBalance, refetchBackpack]);

  React.useEffect(() => {
    refetchWallet();
    apiClient
      .listMembers(guildId)
      .then(setMembers)
      .catch(() => notify.loadFailed(reload, 'wallet'));
  }, [guildId, refetchWallet, reloadKey, notify, reload]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasOpen = false;
    const scheduleRefetch = () => {
      clearTimeout(timer);
      timer = setTimeout(refetchBalance, LIVE_REFETCH_DEBOUNCE_MS);
    };
    const unsubscribe = subscribeLiveEvents(event => {
      if (event.kind === 'open') {
        if (wasOpen) scheduleRefetch();
        wasOpen = true;
        return;
      }
      if (event.kind !== 'wallet' || event.guildId !== guildId) return;
      setWallet(current => (current ? { ...current, balance: event.balance } : current));
      scheduleRefetch();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [guildId, refetchBalance]);

  useLiveResource(LIVE_BACKPACK_RESOURCES, refetchBackpack, { guildId });
  useLiveResource(LIVE_WITHDRAWAL_RESOURCES, refetchBalance, { guildId });

  return {
    wallet,
    transactions,
    backpackItems,
    pendingWithdrawals,
    members,
    walletState,
    transactionsState,
    backpackState,
    balanceTrend,
    reload,
    refetchBalance,
    refetchBackpack,
    refetchWallet,
  };
}
