'use client';

import React from 'react';
import { subscribeLiveEvents, type LiveResource, type ResourceChangedEvent } from '@/lib/live-events';

interface UseLiveResourceOptions {
  guildId?: string;
  match?: (event: ResourceChangedEvent) => boolean;
  debounceMs?: number;
}

export function useLiveResource(
  resources: readonly LiveResource[],
  onChange: () => void,
  { guildId, match, debounceMs = 250 }: UseLiveResourceOptions = {},
) {
  const onChangeRef = React.useRef(onChange);
  const matchRef = React.useRef(match);
  React.useEffect(() => {
    onChangeRef.current = onChange;
    matchRef.current = match;
  });

  const resourceKey = resources.join(',');

  React.useEffect(() => {
    const watched = new Set(resourceKey.split(','));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasOpen = false;

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onChangeRef.current(), debounceMs);
    };

    const unsubscribe = subscribeLiveEvents(event => {
      if (event.kind === 'open') {
        if (wasOpen) schedule();
        wasOpen = true;
        return;
      }
      if (event.kind !== 'resource' || !watched.has(event.resource)) return;
      if (guildId && event.guildId && event.guildId !== guildId) return;
      if (matchRef.current && !matchRef.current(event)) return;
      schedule();
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [resourceKey, guildId, debounceMs]);
}
