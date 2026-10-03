'use client';

import { useOverlayState, type Key } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { hasRollCallFormErrors, useRollCallFormErrors } from '@/components/RollCallFormFields';
import { useToast } from '@/hooks/useToast';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import type { ItemTemplate, RollCallTemplate } from '@/types/roll-call';
import {
  DRAFT_KEY,
  currentMinute,
  defaultExpireTime,
  emptyDraft,
  readStoredDraft,
  toLootEntry,
  type RollCallDraft,
} from '../_lib/draft';

type RollCallDraftOptions = {
  guildId: string;
  templates: RollCallTemplate[];
  onCreated: () => void;
};

export function useRollCallDraft({ guildId, templates, onCreated }: RollCallDraftOptions) {
  const t = useTranslations('rollCall');
  const notify = useToast();
  const modalState = useOverlayState();
  const [isCreating, setIsCreating] = React.useState(false);
  const [draft, setDraft] = React.useState<RollCallDraft>(emptyDraft);
  const [showErrors, setShowErrors] = React.useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<Key | null>(null);
  const errors = useRollCallFormErrors(draft);
  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDraft = (newDraft: RollCallDraft) => {
    setDraft(newDraft);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
      } catch {}
    }, 500);
  };

  const updateDraft = (updates: Partial<RollCallDraft>) => {
    persistDraft({ ...draft, ...updates });
  };

  const clearStoredDraft = () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const changeTemplate = (key: Key | null) => {
    setSelectedTemplateId(key);
    const template = templates.find(tpl => tpl.id === key);
    if (!template) return;
    updateDraft({
      title: template.title,
      lootInput: '',
      lootList: [...template.items.map(toLootEntry), ...draft.lootList.filter(entry => entry.kind === 'gold')],
    });
  };

  const pickItemTemplate = (item: ItemTemplate) => {
    updateDraft({ lootList: [...draft.lootList, toLootEntry(item)] });
  };

  const open = () => {
    const restored = readStoredDraft() ?? draft;
    const datetime = restored.datetime || currentMinute();
    persistDraft({ ...restored, datetime, expireTime: restored.expireTime || defaultExpireTime(datetime) });
    setShowErrors(false);
    modalState.open();
  };

  const changeDatetime = (datetime: string) => {
    const expireFollowsDefault =
      !draft.expireTime || (draft.datetime !== '' && draft.expireTime === defaultExpireTime(draft.datetime));
    updateDraft(
      datetime && expireFollowsDefault ? { datetime, expireTime: defaultExpireTime(datetime) } : { datetime },
    );
  };

  const submit = async (trigger: Element) => {
    if (hasRollCallFormErrors(errors)) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsCreating(true);
    try {
      await apiClient.createRollCall(guildId, {
        title: draft.title,
        description: draft.description || undefined,
        datetime: draft.datetime,
        expireTime: draft.expireTime,
        imageUrl: draft.imageUrl.trim() || undefined,
        lootList: draft.lootList,
      });
      onCreated();
      setDraft(emptyDraft);
      setSelectedTemplateId(null);
      clearStoredDraft();
      notify.success(t('createSuccess'));
      modalState.close();
    } catch {
      notify.error(t('createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const cancel = () => {
    setDraft(emptyDraft);
    setSelectedTemplateId(null);
    clearStoredDraft();
  };

  return {
    modalState,
    draft,
    errors,
    showErrors,
    isCreating,
    selectedTemplateId,
    updateDraft,
    changeTemplate,
    pickItemTemplate,
    changeDatetime,
    open,
    submit,
    cancel,
  };
}

export type RollCallDraftController = ReturnType<typeof useRollCallDraft>;
