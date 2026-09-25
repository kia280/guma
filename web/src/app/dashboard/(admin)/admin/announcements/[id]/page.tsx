'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Spinner,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useLocale, useTranslations } from 'next-intl';

import { DeleteAnnouncementDraftDialog } from '@/components/DeleteAnnouncementDraftDialog';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { PageHeader } from '@/components/PageHeader';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import { HTML_LANG, isLocale } from '@/i18n/locales';
import type { AdminAnnouncement, AnnouncementDraftInput } from '@/types/admin';

const AUTOSAVE_DELAY_MS = 800;
const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;
const ANNOUNCEMENTS_HREF = '/dashboard/admin?tab=announcements';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const draftKey = (input: AnnouncementDraftInput) =>
  JSON.stringify([input.title, input.content, input.pinned]);

export default function AnnouncementEditorPage() {
  const t = useTranslations('adminPage');
  const locale = useLocale();
  const router = useRouter();
  const guildId = useCurrentGuildId();
  const { id } = useParams<{ id: string }>();

  const [announcement, setAnnouncement] = React.useState<AdminAnnouncement | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [values, setValues] = React.useState<AnnouncementDraftInput>({ title: '', content: '', pinned: false });
  const [saveState, setSaveState] = React.useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [isPublishing, setIsPublishing] = React.useState(false);
  const [publishFailed, setPublishFailed] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const latest = React.useRef<AnnouncementDraftInput | null>(null);
  const savedKey = React.useRef('');
  const inFlight = React.useRef<Promise<boolean> | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.getAnnouncement(guildId, id)
      .then(ann => {
        if (cancelled) return;
        const input = { title: ann.title, content: ann.content, pinned: ann.pinned };
        latest.current = ann.status === 'draft' ? input : null;
        savedKey.current = draftKey(input);
        setAnnouncement(ann);
        setValues(input);
        setLastSavedAt(ann.updatedAt);
      })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [guildId, id]);

  const save = React.useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    while (inFlight.current) await inFlight.current;
    const input = latest.current;
    if (!input) return true;
    const key = draftKey(input);
    if (key === savedKey.current) return true;

    setSaveState('saving');
    const request = apiClient.updateAnnouncementDraft(guildId, id, input)
      .then(saved => {
        savedKey.current = key;
        setLastSavedAt(saved.updatedAt);
        return true;
      })
      .catch(err => {
        console.error('Failed to autosave announcement draft', err);
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
    void flushRef.current();
  }, []);

  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current && draftKey(latest.current) !== savedKey.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const update = (patch: Partial<AnnouncementDraftInput>) => {
    setValues(prev => {
      const next = { ...prev, ...patch };
      latest.current = next;
      return next;
    });
    setPublishFailed(false);
    setSaveState('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, AUTOSAVE_DELAY_MS);
  };

  const publish = async () => {
    setIsPublishing(true);
    setPublishFailed(false);
    try {
      if (!(await flush())) throw new Error('draft not saved');
      await apiClient.publishAnnouncement(guildId, id);
      latest.current = null;
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
    <Button variant="ghost" size="sm" onPress={() => router.push(ANNOUNCEMENTS_HREF)}>
      <Icon icon="solar:arrow-left-linear" width={16} />
      {t('backToAnnouncements')}
    </Button>
  );

  if (loadFailed) {
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
      <div className="flex justify-center py-16">
        <Spinner size="lg" aria-label={t('loadingDraft')} />
      </div>
    );
  }

  if (announcement.status !== 'draft') {
    return (
      <div className="space-y-5">
        {backButton}
        <Card className="border border-divider shadow-none bg-surface">
          <Card.Content className="p-6 text-center">
            <p className="type-subheading text-foreground">{t('alreadyPublished')}</p>
            <p className="type-body text-subtle mt-1">{t('alreadyPublishedHint')}</p>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const canPublish = values.title.trim() !== '' && values.content.trim() !== '';
  const saveStatus = {
    saved: { icon: 'solar:check-circle-linear', className: 'text-hint', label: lastSavedAt ? t('savedAt', { time: formatSavedAt(lastSavedAt) }) : t('saved') },
    dirty: { icon: 'solar:pen-linear', className: 'text-hint', label: t('unsavedChanges') },
    saving: { icon: 'solar:refresh-linear', className: 'text-hint', label: t('saving') },
    error: { icon: 'solar:danger-triangle-linear', className: 'text-danger', label: t('saveFailed') },
  }[saveState];

  return (
    <div className="space-y-5">
      {backButton}

      <PageHeader title={t('editAnnouncement')} description={t('editAnnouncementHint')}>
        <Chip size="sm" variant="secondary" color="warning">{t('draft')}</Chip>
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

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="type-body text-foreground">{t('pinAnnouncement')}</p>
              <p className="type-caption text-hint">{t('pinNote')}</p>
            </div>
            <Switch
              isSelected={values.pinned}
              onChange={pinned => update({ pinned })}
              size="sm"
              aria-label={t('pinAnnouncement')}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
        </Card.Content>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="status" aria-live="polite" className={`flex items-center gap-1.5 type-caption ${saveStatus.className}`}>
          <Icon icon={saveStatus.icon} width={14} className={saveState === 'saving' ? 'animate-spin' : undefined} />
          <span>{saveStatus.label}</span>
          {saveState === 'error' && (
            <Button variant="ghost" size="sm" onPress={() => { void save(); }}>
              {t('retry')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="danger" size="sm" onPress={() => setIsDeleteOpen(true)} isDisabled={isPublishing}>
            <Icon icon="solar:trash-bin-trash-linear" width={16} />
            {t('deleteDraft')}
          </Button>
          <Button variant="primary" size="sm" onPress={publish} isPending={isPublishing} isDisabled={!canPublish}>
            <Icon icon="solar:plain-linear" width={16} />
            {t('publish')}
          </Button>
        </div>
      </div>

      {!canPublish && <p className="type-caption text-hint text-right">{t('publishRequirement')}</p>}
      {publishFailed && (
        <p role="alert" className="type-caption text-danger text-right">{t('publishFailed')}</p>
      )}

      <DeleteAnnouncementDraftDialog
        title={values.title}
        isOpen={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={deleteDraft}
      />
    </div>
  );
}
