'use client';

// Single source for the authenticated user's current guild id.
// Fetches GET /v1/me once on mount and exposes `currentGuildId` via context.
// Rendered children only mount after the id resolves, so consumers can
// assume useCurrentGuildId() returns a non-empty string.

import React from 'react';
import { apiClient } from '@/lib/guma';

const CurrentGuildContext = React.createContext<string | null>(null);

export function CurrentGuildProvider({ children }: { children: React.ReactNode }) {
  const [guildId, setGuildId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getMe()
      .then((u) => {
        if (!cancelled) setGuildId(u.currentGuildId || '');
      })
      .catch(() => {
        if (!cancelled) setGuildId('');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (guildId === null) return null;

  return (
    <CurrentGuildContext.Provider value={guildId}>{children}</CurrentGuildContext.Provider>
  );
}

export function useCurrentGuildId(): string {
  const id = React.useContext(CurrentGuildContext);
  if (id === null) {
    throw new Error('useCurrentGuildId must be used inside <CurrentGuildProvider>');
  }
  return id;
}
