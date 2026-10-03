'use client';

import React from 'react';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import type { ItemTemplate, RollCallTemplate } from '@/types/roll-call';

export type TemplatesState = 'loading' | 'ready' | 'failed' | 'hidden';

export function useRollCallTemplates(guildId: string) {
  const [templates, setTemplates] = React.useState<RollCallTemplate[]>([]);
  const [itemTemplates, setItemTemplates] = React.useState<ItemTemplate[]>([]);
  const [state, setState] = React.useState<TemplatesState>('loading');

  const fetchTemplates = React.useCallback(
    () =>
      Promise.all([apiClient.listRollCallTemplates(guildId), apiClient.listItemTemplates(guildId)])
        .then(([rollCallList, itemList]) => {
          setTemplates(rollCallList);
          setItemTemplates(itemList);
          setState('ready');
        })
        .catch(err => {
          setState(apiErrorCode(err) === GrpcCode.PermissionDenied ? 'hidden' : 'failed');
        }),
    [guildId]
  );

  const retry = React.useCallback(async () => {
    setState('loading');
    await fetchTemplates();
  }, [fetchTemplates]);

  const [templatesGuildId, setTemplatesGuildId] = React.useState(guildId);
  if (templatesGuildId !== guildId) {
    setTemplatesGuildId(guildId);
    setState('loading');
  }

  React.useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return { templates, itemTemplates, state, retry };
}

export type RollCallTemplates = ReturnType<typeof useRollCallTemplates>;
