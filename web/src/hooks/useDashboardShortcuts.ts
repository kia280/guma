'use client';

import React from 'react';
import { NAV_SHORTCUTS } from '@/lib/dashboard-nav';

const CHORD_TIMEOUT_MS = 1200;

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.getAttribute('role') === 'textbox';
};

export function useDashboardShortcuts({
  onToggleSidebar,
  onNavigate,
}: {
  onToggleSidebar: () => void;
  onNavigate: (href: string) => void;
}) {
  const handlers = React.useRef({ onToggleSidebar, onNavigate });

  React.useEffect(() => {
    handlers.current = { onToggleSidebar, onNavigate };
  });

  React.useEffect(() => {
    let chordStartedAt = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;

      const key = event.key.toLowerCase();
      const isChord = Date.now() - chordStartedAt < CHORD_TIMEOUT_MS;
      chordStartedAt = 0;

      if (isChord && NAV_SHORTCUTS[key]) {
        event.preventDefault();
        handlers.current.onNavigate(NAV_SHORTCUTS[key]);
        return;
      }
      if (key === 'g') {
        chordStartedAt = Date.now();
        return;
      }
      if (event.key === '[') {
        event.preventDefault();
        handlers.current.onToggleSidebar();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
