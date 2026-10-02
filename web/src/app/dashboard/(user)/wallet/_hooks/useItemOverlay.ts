'use client';

import { useOverlayState } from '@heroui/react';
import React from 'react';

export function useItemOverlay<T>() {
  const state = useOverlayState();
  const [item, setItem] = React.useState<T | null>(null);
  const open = (next: T) => {
    setItem(next);
    state.open();
  };
  return { state, item, open };
}
