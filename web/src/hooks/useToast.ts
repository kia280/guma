'use client';

import { toast } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';

type ToastAction = {
  label: string;
  onPress: () => void;
};

type InfoToastOptions = {
  description?: string;
  action?: ToastAction;
};

type ErrorToastOptions = {
  description?: string;
  retry?: () => void;
  key?: string;
};

const RETRY_TIMEOUT_MS = 8000;
const ACTION_TIMEOUT_MS = 10000;

const openErrorToasts = new Map<string, string>();

export function useToast() {
  const t = useTranslations('feedback');
  const translate = React.useRef(t);

  React.useEffect(() => {
    translate.current = t;
  }, [t]);

  return React.useMemo(() => {
    const error = (title: string, { description, retry, key }: ErrorToastOptions = {}) => {
      const existing = key ? openErrorToasts.get(key) : undefined;
      if (existing) return existing;
      const id: string = toast.danger(title, {
        description,
        timeout: retry ? RETRY_TIMEOUT_MS : undefined,
        onClose: () => {
          if (key && openErrorToasts.get(key) === id) openErrorToasts.delete(key);
        },
        actionProps: retry
          ? {
              children: translate.current('retry'),
              variant: 'tertiary',
              onPress: () => {
                toast.close(id);
                retry();
              },
            }
          : undefined,
      });
      if (key) openErrorToasts.set(key, id);
      return id;
    };

    const info = (title: string, { description, action }: InfoToastOptions = {}) => {
      const id: string = toast.info(title, {
        description,
        timeout: action ? ACTION_TIMEOUT_MS : undefined,
        actionProps: action
          ? {
              children: action.label,
              variant: 'tertiary',
              onPress: () => {
                toast.close(id);
                action.onPress();
              },
            }
          : undefined,
      });
      return id;
    };

    return {
      success: (title: string, description?: string) => toast.success(title, { description }),
      info,
      error,
      actionFailed: () => error(translate.current('actionFailed')),
      loadFailed: (retry?: () => void, key = 'load') =>
        error(translate.current('loadFailed'), { retry, key }),
    };
  }, []);
}
