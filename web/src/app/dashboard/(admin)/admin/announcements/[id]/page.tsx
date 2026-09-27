'use client';

import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Skeleton,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent } from '@/components/AsyncContent';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { PageHeader } from '@/components/PageHeader';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { HTML_LANG, isLocale } from '@/i18n/locales';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import type { AdminAnnouncement, AnnouncementDraftInput } from '@/types/admin';

const AUTOSAVE_DELAY_MS = 800;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;
const ANNOUNCEMENTS_HREF = '/dashboard/admin?tab=announcements';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type PendingConfirm = 'delete' | 'unpublish' | 'discard' | null;

const draftKey = (input: AnnouncementDraftInput) =>
  JSON.stringify([input.title, input.content, input.pinned]);

export default function AnnouncementEditorPage() {
  const t = useTranslations('adminPage');
  const locale = useLocale();
  const router = useRouter();
  const guildId = useCurrentGuildId();
  const { id } = useParams<{ id: string }>();

  const [announcement, setAnnouncement] = React.useState<AdminAnnouncement | null>(null);
  const [isMissing, setIsMissing] = React.useState(false);
  const loadState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    loadState.reset();
    setReloadKey(key => key + 1);
  }, [loadState.reset]);
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
        loadState.ready();
      })
      .catch(err => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setIsMissing(true);
          return;
        }
        loadState.failed();
      });
    return () => { cancelled = true; };
  }, [guildId, id, reloadKey, loadState.ready, loadState.failed]);

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

  const leave = async () => {
    if (!isDraftRef.current && hasUnsavedChanges()) {
      setPendingConfirm('discard');
      return;
    }
    if (!(await flush())) return;
    router.push(ANNOUNCEMENTS_HREF);
  };

  const discardAndLeave = () => {
    latest.current = null;
    router.push(ANNOUNCEMENTS_HREF);
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

  const formatSavedAt = (value: string) =>
    new Date(value).toLocaleTimeString(isLocale(locale) ? HTML_LANG[locale] : locale, {
      hour: '2-digit',
      minute: '2-digit',
    });

  const backButton = (
    <Button variant="ghost" size="sm" className="max-sm:h-11" onPress={leave}>
      <Icon icon="solar:arrow-left-linear" width={16} />
      {t('backToAnnouncements')}
    </Button>
  );

  if (isMissing) {
    return (
      <div className="space-y-5">
        {backButton}
        <Card className="border border-divider shadow-none bg-surface">
          <Card.Content className="p-6 text-center">
            <p className="type-subheading text-foreground">{t('draftNotFound')}</p>
            <p className="type-body text-subtle mt-1">{t('draftNotFoundHint')}</p>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (!announcement) {
    return (
      <div className="space-y-5">
        {backButton}
        <AsyncContent
          state={loadState.state}
          onRetry={reload}
          skeleton={
            <div className="space-y-5" aria-busy="true" aria-label={t('loadingDraft')}>
              <Skeleton className="h-8 w-1/2 rounded-lg" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
          }
        >
          {null}
        </AsyncContent>
      </div>
    );
  }

  const isDraft = announcement.status === 'draft';
  const canPublish = values.title.trim() !== '' && values.content.trim() !== '';
  const saveStatus = {
    saved: { icon: 'solar:check-circle-linear', className: 'text-hint', label: lastSavedAt ? t('savedAt', { time: formatSavedAt(lastSavedAt) }) : t('saved') },
    dirty: { icon: 'solar:pen-linear', className: 'text-hint', label: t('unsavedChanges') },
    saving: { icon: 'solar:refresh-linear', className: 'text-hint', label: t('saving') },
    error: { icon: 'solar:danger-triangle-linear', className: 'text-danger', label: isDraft ? t('saveFailed') : t('saveChangesFailed') },
  }[saveState];

  return (
    <div className="space-y-5">
      {backButton}

      <PageHeader title={t('editAnnouncement')} description={isDraft ? t('editAnnouncementHint') : t('editPublishedHint')}>
        {isDraft
          ? <Chip size="sm" variant="secondary" color="warning">{t('draft')}</Chip>
          : <Chip size="sm" variant="secondary" color="success">{t('published')}</Chip>}
      </PageHeader>

      <Card className="border border-divider shadow-none bg-surface">
        <Card.Content className="p-4 sm:p-6 flex flex-col gap-4">
          <TextField
            value={values.title}
            onChange={title => update({ title })}
            maxLength={MAX_TITLE_LENGTH}
            autoFocus={values.title === ''}
          >
            <Label>{t('announcementTitle')}</Label>
            <Input placeholder={t('announcementTitlePlaceholder')} variant="secondary" />
          </TextField>

          <Tabs variant="secondary" aria-label={t('announcementContent')}>
            <Tabs.ListContainer>
              <Tabs.List aria-label={t('announcementContent')}>
                <Tabs.Tab id="write">
                  {t('write')}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="preview">
                  {t('preview')}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id="write" className="pt-3">
              <TextField
                value={values.content}
                onChange={content => update({ content })}
                maxLength={MAX_CONTENT_LENGTH}
              >
                <Label>{t('announcementContent')}</Label>
                <TextArea placeholder={t('announcementContentPlaceholder')} variant="secondary" rows={12} />
                <Description>{t('contentLength', { count: values.content.length, max: MAX_CONTENT_LENGTH })}</Description>
              </TextField>
            </Tabs.Panel>
            <Tabs.Panel id="preview" className="pt-3">
              <div className="min-h-64 rounded-lg border border-divider p-4">
                {values.content.trim() ? (
                  <DiscordMarkdown content={values.content} className="type-prose text-foreground" />
                ) : (
                  <p className="type-body text-disabled">{t('nothingToPreview')}</p>
                )}
              </div>
            </Tabs.Panel>
          </Tabs>
          <p className="type-caption text-hint">{t('markdownHint')}</p>

          <Switch
            isSelected={values.pinned}
            onChange={pinned => update({ pinned })}
            size="sm"
            aria-labelledby="announcement-pin-label"
            aria-describedby="announcement-pin-description"
            className="w-full"
          >
            <Switch.Content className="w-full min-h-11 justify-between gap-3 font-normal">
              <span>
                <span id="announcement-pin-label" className="block type-body text-foreground">{t('pinAnnouncement')}</span>
                <span id="announcement-pin-description" className="block type-caption text-hint">{t('pinNote')}</span>
              </span>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </Card.Content>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="status" aria-live="polite" className={`flex items-center gap-1.5 type-caption ${saveStatus.className}`}>
          <Icon icon={saveStatus.icon} width={14} className={saveState === 'saving' ? 'animate-spin' : undefined} />
          <span>{saveStatus.label}</span>
          {saveState === 'error' && isDraft && (
            <Button variant="ghost" size="sm" className="max-sm:h-11" onPress={() => { void save(); }}>
              {t('retry')}
            </Button>
          )}
        </div>

        {isDraft ? (
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" className="max-sm:h-11" onPress={() => setPendingConfirm('delete')} isDisabled={isPublishing}>
              <Icon icon="solar:trash-bin-trash-linear" width={16} />
              {t('deleteDraft')}
            </Button>
            <Button variant="primary" size="sm" className="max-sm:h-11" onPress={publish} isPending={isPublishing} isDisabled={!canPublish}>
              <Icon icon="solar:plain-linear" width={16} />
              {t('publish')}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={() => setPendingConfirm('unpublish')} isDisabled={saveState === 'saving'}>
              <Icon icon="solar:undo-left-linear" width={16} />
              {t('unpublish')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="max-sm:h-11"
              onPress={() => { void save(); }}
              isPending={saveState === 'saving'}
              isDisabled={!canPublish || (saveState !== 'dirty' && saveState !== 'error')}
            >
              <Icon icon="solar:diskette-linear" width={16} />
              {t('saveChanges')}
            </Button>
          </div>
        )}
      </div>

      {!canPublish && (
        <p className="type-caption text-hint text-right">{isDraft ? t('publishRequirement') : t('publishedRequirement')}</p>
      )}
      {publishFailed && (
        <p role="alert" className="type-caption text-danger text-right">{t('publishFailed')}</p>
      )}

      <ConfirmDialog
        heading={t('deleteDraftTitle')}
        body={t('deleteDraftBody', { title: values.title.trim() || t('untitledDraft') })}
        confirmLabel={t('delete')}
        failedMessage={t('deleteDraftFailed')}
        isOpen={pendingConfirm === 'delete'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={deleteDraft}
      />
      <ConfirmDialog
        heading={t('unpublishTitle')}
        body={t('unpublishBody', { title: values.title })}
        confirmLabel={t('unpublish')}
        failedMessage={t('unpublishFailed')}
        status="warning"
        isOpen={pendingConfirm === 'unpublish'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={unpublish}
      />
      <ConfirmDialog
        heading={t('discardChangesTitle')}
        body={t('discardChangesBody')}
        confirmLabel={t('discardChanges')}
        failedMessage={t('discardFailed')}
        status="warning"
        isOpen={pendingConfirm === 'discard'}
        onOpenChange={open => { if (!open) setPendingConfirm(null); }}
        onConfirm={discardAndLeave}
      />
    </div>
  );
}
