'use client';

import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import type { GuildBank, GuildBankItem, GuildContribution } from '@/types/guild-bank';

export function useGuildBankData(guildId: string) {
  const notify = useToast();
  const [bank, setBank] = React.useState<GuildBank | null>(null);
  const [contributions, setContributions] = React.useState<GuildContribution[]>([]);
  const [items, setItems] = React.useState<GuildBankItem[]>([]);
  const { state: bankState, ready: bankReady, failed: bankFailed, reset: resetBank } = useLoadState();
  const {
    state: contributionsState,
    ready: contributionsReady,
    failed: contributionsFailed,
    reset: resetContributions,
  } = useLoadState();
  const { state: itemsState, ready: itemsReady, failed: itemsFailed, reset: resetItems } = useLoadState();
  const [reloadKey, setReloadKey] = React.useState(0);

  const reload = React.useCallback(() => {
    resetBank();
    resetContributions();
    resetItems();
    setReloadKey(key => key + 1);
  }, [resetBank, resetContributions, resetItems]);

  const latestRefetch = React.useRef(0);

  const refetchBank = React.useCallback(() => {
    const refetchId = ++latestRefetch.current;
    const ifLatest = <T,>(apply: (value: T) => void) => (value: T) => {
      if (refetchId === latestRefetch.current) apply(value);
    };
    const onLoadFailed = (markFailed: () => void) =>
      ifLatest(() => {
        markFailed();
        notify.loadFailed(reload, 'guild-bank');
      });
    apiClient
      .getGuildBank(guildId)
      .then(ifLatest(data => {
        setBank(data);
        bankReady();
      }))
      .catch(onLoadFailed(bankFailed));
    apiClient
      .listContributions(guildId)
      .then(ifLatest(data => {
        setContributions(data);
        contributionsReady();
      }))
      .catch(onLoadFailed(contributionsFailed));
    apiClient
      .listBankItems(guildId)
      .then(ifLatest(data => {
        setItems(data);
        itemsReady();
      }))
      .catch(onLoadFailed(itemsFailed));
  }, [guildId, notify, reload, bankReady, bankFailed, contributionsReady, contributionsFailed, itemsReady, itemsFailed]);

  React.useEffect(() => {
    refetchBank();
  }, [refetchBank, reloadKey]);

  useLiveResource(['bank'], refetchBank, { guildId });

  return {
    bank,
    contributions,
    items,
    bankState,
    contributionsState,
    itemsState,
    reload,
    refetchBank,
  };
}
