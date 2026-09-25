'use client';

import React from 'react';

export type LoadState = 'loading' | 'ready' | 'failed';

export function useLoadState() {
  const [state, setState] = React.useState<LoadState>('loading');
  const ready = React.useCallback(() => setState('ready'), []);
  const failed = React.useCallback(
    () => setState(current => (current === 'ready' ? current : 'failed')),
    [],
  );
  const reset = React.useCallback(
    () => setState(current => (current === 'ready' ? current : 'loading')),
    [],
  );
  return React.useMemo(() => ({ state, ready, failed, reset }), [state, ready, failed, reset]);
}
