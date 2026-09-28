'use client';

import { useSyncExternalStore } from 'react';
import type { DeviceClass } from '@/lib/calendar';

const PHONE_QUERY = '(max-width: 639px)';
const DESKTOP_QUERY = '(min-width: 1280px)';

const subscribe = (onChange: () => void) => {
  const queries = [window.matchMedia(PHONE_QUERY), window.matchMedia(DESKTOP_QUERY)];
  queries.forEach(query => query.addEventListener('change', onChange));
  return () => queries.forEach(query => query.removeEventListener('change', onChange));
};

const getSnapshot = (): DeviceClass => {
  if (window.matchMedia(PHONE_QUERY).matches) return 'phone';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  return 'tablet';
};

const getServerSnapshot = (): DeviceClass | null => null;

export function useDeviceClass(): DeviceClass | null {
  return useSyncExternalStore<DeviceClass | null>(subscribe, getSnapshot, getServerSnapshot);
}
