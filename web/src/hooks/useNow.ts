'use client';

import { useEffect, useState } from 'react';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export function nextCountdownDelay(remainingMs: number) {
  if (remainingMs <= 0) return null;
  const step = remainingMs <= MINUTE_MS ? SECOND_MS : MINUTE_MS;
  const untilNextStep = remainingMs % step || step;
  return Math.min(untilNextStep, remainingMs);
}

export function useCountdown(target: string | number | Date | null | undefined) {
  const targetMs = target == null ? null : new Date(target).getTime();
  const hasTarget = targetMs !== null && !Number.isNaN(targetMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasTarget) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (from: number) => {
      const delay = nextCountdownDelay(targetMs - from);
      if (delay === null) return;
      timer = setTimeout(() => {
        const current = Date.now();
        setNow(current);
        schedule(current);
      }, delay);
    };
    timer = setTimeout(() => {
      const current = Date.now();
      setNow(current);
      schedule(current);
    }, 0);
    return () => clearTimeout(timer);
  }, [hasTarget, targetMs]);

  const remainingMs = hasTarget ? Math.max(0, targetMs - now) : 0;
  return { now, remainingMs, isExpired: hasTarget && targetMs <= now };
}
