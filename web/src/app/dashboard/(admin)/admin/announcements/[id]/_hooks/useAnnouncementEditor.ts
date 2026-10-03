'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import type { AdminAnnouncement, AnnouncementDraftInput } from '@/types/admin';

const AUTOSAVE_DELAY_MS = 800;
const ANNOUNCEMENTS_HREF = '/dashboard/admin?tab=announcements';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type PendingConfirm = 'delete' | 'unpublish' | 'discard' | null;

const draftKey = (input: AnnouncementDraftInput) =>
  JSON.stringify([input.title, input.content, input.pinned]);

export function useAnnouncementEditor() {
  const t = useTranslations('adminPage');
  const router = useRouter();
  const guildId = useCurrentGuildId();
  const { id } = useParams<{ id: string }>();

  const [announcement, setAnnouncement] = React.useState<AdminAnnouncement | null>(null);
  const [isMissing, setIsMissing] = React.useState(false);
  const loadState = useLoadState();
  const { ready: loadReady, failed: loadFailed, reset: resetLoad } = loadState;
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    resetLoad();
    setReloadKey(key => key + 1);
  }, [resetLoad]);
  const [values, setValues] = React.useState<AnnouncementDraftInput>({ title: '', content: '', pinned: false });
  const [saveState, setSaveState] = React.useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishFailed, setPublishFailed] = React.useState(false);
  const [pendingConfirm, setPendingConfirm] = React.useState<PendingConfirm>(null);

  const latest = React.useRef<AnnouncementDraftInput | null>(null);
  const isDraftRef = React.useRef(false);
  const savedKey = React.useRef('');
  const inFlight = React.useRef<Promise<boolean> | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingHref = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.getAnnouncement(guildId, id)
      .then(ann => {
        if (cancelled) return;
        const input = { title: ann.title, content: ann.content, pinned: ann.pinned };
        latest.current = input;
        isDraftRef.current = ann.status === 'draft';
        savedKey.current = draftKey(input);
        setAnnouncement(ann);
        setValues(input);
        setLastSavedAt(ann.updatedAt);
        loadReady();
      })
      .catch(err => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setIsMissing(true);
          return;
        }
        loadFailed();
      });
    return () => { cancelled = true; };
  }, [guildId, id, reloadKey, loadReady, loadFailed]);

  const save = React.useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    const input = latest.current;
    if (!input) return true;
    const key = draftKey(input);
    if (key === savedKey.current) return true;

    setSaveState('saving');
    const request = apiClient.updateAnnouncement(guildId, id, input)
      .then(saved => {
        savedKey.current = key;
        setLastSavedAt(saved.updatedAt);
        return true;
      })
      .catch(err => {
        console.error('Failed to save announcement', err);
        return false;
      });
    inFlight.current = request;
    const ok = await request;
    inFlight.current = null;

    const pending = latest.current !== null && draftKey(latest.current) !== savedKey.current;
    setSaveState(!ok ? 'error' : pending ? 'dirty' : 'saved');
    return ok;
  }, [guildId, id]);

  const flush = React.useCallback(async (): Promise<boolean> => {
    while (latest.current && draftKey(latest.current) !== savedKey.current) {
      if (!(await save())) return false;
    }
    return true;
  }, [save]);

  const flushRef = React.useRef(flush);
  React.useEffect(() => { flushRef.current = flush; }, [flush]);

  React.useEffect(() => () => {
    clearTimeout(timer.current);
    if (isDraftRef.current) void flushRef.current();
  }, []);

  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current && draftKey(latest.current) !== savedKey.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const scheduleSave = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, AUTOSAVE_DELAY_MS);
  };

  const update = (patch: Partial<AnnouncementDraftInput>) => {
    const next = { ...(latest.current ?? values), ...patch };
    latest.current = next;
    setValues(next);
    setPublishFailed(false);
    setSaveState('dirty');
    if (isDraftRef.current) scheduleSave();
  };

  const hasUnsavedChanges = () => latest.current !== null && draftKey(latest.current) !== savedKey.current;

  const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges);
  React.useEffect(() => { hasUnsavedChangesRef.current = hasUnsavedChanges; });

  React.useEffect(() => {
    const guardLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (isDraftRef.current || !hasUnsavedChangesRef.current()) return;
      event.preventDefault();
      event.stopPropagation();
      pendingHref.current = `${url.pathname}${url.search}`;
      setPendingConfirm('discard');
    };
    document.addEventListener('click', guardLinks, true);
    return () => document.removeEventListener('click', guardLinks, true);
  }, []);

  const unpublish = async () => {
    const ann = await apiClient.unpublishAnnouncement(guildId, id);
    isDraftRef.current = true;
    setAnnouncement(ann);
    if (hasUnsavedChanges()) {
      setSaveState('dirty');
      scheduleSave();
    } else {
      setLastSavedAt(ann.updatedAt);
    }
  };

  const discardAndLeave = () => {
    latest.current = null;
    router.push(pendingHref.current ?? ANNOUNCEMENTS_HREF);
  };

  const publish = async () => {
    setIsPublishing(true);
    setPublishFailed(false);
    try {
      if (!(await flush())) throw new Error('draft not saved');
      await apiClient.publishAnnouncement(guildId, id);
      latest.current = null;
      notify.success(t('announcementPublished'));
      router.push(ANNOUNCEMENTS_HREF);
    } catch (err) {
      console.error('Failed to publish announcement', err);
      setPublishFailed(true);
      setIsPublishing(false);
    }
  };

  const deleteDraft = async () => {
    clearTimeout(timer.current);
    const pendingInput = latest.current;
    latest.current = null;
    while (inFlight.current) await inFlight.current;
    try {
      await apiClient.deleteAnnouncementDraft(guildId, id);
    } catch (err) {
      latest.current = pendingInput;
      if (hasUnsavedChanges()) scheduleSave();
      throw err;
    }
    router.push(ANNOUNCEMENTS_HREF);
  };

  return {
    announcement,
    isMissing,
    loadState: loadState.state,
    reload,
    values,
    update,
    saveState,
    lastSavedAt,
    isPublishing,
    publishFailed,
    pendingConfirm,
    setPendingConfirm,
    save,
    publish,
    deleteDraft,
    unpublish,
    discardAndLeave,
  };
}

export type AnnouncementEditor = ReturnType<typeof useAnnouncementEditor>;
