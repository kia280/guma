'use client';

import { isDevMockEnabled } from '@/lib/dev-mock';
import { env } from '@/lib/env';
import { fromMinorUnits } from '@/lib/guma/money';

export type LiveResource = 'bank' | 'auction' | 'lottery' | 'checkin' | 'notification' | 'announcement' | 'backpack';

export interface ResourceChangedEvent {
  kind: 'resource';
  guildId: string;
  resource: string;
  resourceId: string;
}

export type LiveEvent =
  | { kind: 'open' }
  | { kind: 'closed' }
  | { kind: 'wallet'; guildId: string; balance: number }
  | ResourceChangedEvent;

type Listener = (event: LiveEvent) => void;

type Frame = {
  result?: {
    wallet_updated?: { guild_id?: string; balance?: string | number };
    resource_changed?: { guild_id?: string; resource?: string; resource_id?: string };
  };
};

const RECONNECT_DELAY_MS = 30_000;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let streamOpen = false;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

export const emitLiveEvent = (event: LiveEvent) => {
  listeners.forEach(listener => listener(event));
};

export const parseLiveEvent = (data: string): LiveEvent | null => {
  let frame: Frame;
  try {
    frame = JSON.parse(data) as Frame;
  } catch {
    return null;
  }
  const wallet = frame.result?.wallet_updated;
  if (wallet?.guild_id) {
    return { kind: 'wallet', guildId: wallet.guild_id, balance: fromMinorUnits(wallet.balance) };
  }
  const changed = frame.result?.resource_changed;
  if (changed?.resource) {
    return {
      kind: 'resource',
      guildId: changed.guild_id ?? '',
      resource: changed.resource,
      resourceId: changed.resource_id ?? '',
    };
  }
  return null;
};

const setClosed = () => {
  if (!streamOpen) return;
  streamOpen = false;
  emitLiveEvent({ kind: 'closed' });
};

const connect = () => {
  if (typeof window === 'undefined' || env.useMock || isDevMockEnabled()) return;
  source = new EventSource(new URL('/v1/me/events', env.api.url), { withCredentials: true });
  source.onopen = () => {
    streamOpen = true;
    emitLiveEvent({ kind: 'open' });
  };
  source.onmessage = message => {
    const event = parseLiveEvent(message.data);
    if (event) emitLiveEvent(event);
  };
  source.onerror = () => {
    setClosed();
    if (source?.readyState === EventSource.CLOSED) {
      source.close();
      source = null;
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  };
};

const disconnect = () => {
  clearTimeout(reconnectTimer);
  source?.close();
  source = null;
  setClosed();
};

export const subscribeLiveEvents = (listener: Listener) => {
  listeners.add(listener);
  if (listeners.size === 1) connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) disconnect();
  };
};

export const isLiveStreamOpen = () => streamOpen;
