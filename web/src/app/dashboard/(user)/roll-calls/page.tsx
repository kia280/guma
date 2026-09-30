'use client';

import { Button, Card, Chip, Modal, Tabs, Label, Description, ListBox, Select, useOverlayState, type Key } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton, EmptyContent } from '@/components/AsyncContent';
import { ItemTemplatePicker } from '@/components/ItemTemplatePicker';
import { LootListEditor } from '@/components/LootListEditor';
import { RollCallFormFields, hasRollCallFormErrors, useRollCallFormErrors, type RollCallFormValues } from '@/components/RollCallFormFields';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import { rollCallStatusColor } from '@/lib/status-colors';
import { RollCallStatus, type RollCall, type RollCallTemplate, type ItemTemplate, type LootEntry } from '@/types/roll-call';
import { RollCallCard } from './RollCallCard';

const DRAFT_KEY = 'roll_call_draft';

const STATUS_TABS = [
  { id: 'all', status: null },
  { id: 'open', status: RollCallStatus.OPEN },
  { id: 'finished', status: RollCallStatus.FINISHED },
  { id: 'completed', status: RollCallStatus.COMPLETED },
  { id: 'cancelled', status: RollCallStatus.CANCELLED },
] as const;

interface RollCallDraft extends RollCallFormValues {
  lootInput: string;
  lootList: LootEntry[];
}

const toLootEntry = (item: ItemTemplate): LootEntry => ({
  name: item.name,
  description: item.description || undefined,
  category: item.category,
  rarity: item.rarity,
});

const DEFAULT_WINDOW_MS = 12 * 60 * 60 * 1000;

const currentMinute = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

const defaultExpireTime = (datetime: string) =>
  new Date(new Date(datetime).getTime() + DEFAULT_WINDOW_MS).toISOString();

const emptyDraft: RollCallDraft = {
  title: '',
  description: '',
  datetime: '',
  expireTime: '',
  imageUrl: '',
  lootInput: '',
  lootList: [],
};

const readStoredDraft = (): RollCallDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RollCallDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      datetime: typeof parsed.datetime === 'string' ? parsed.datetime : '',
      expireTime: typeof parsed.expireTime === 'string' ? parsed.expireTime : '',
      imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : '',
      lootInput: typeof parsed.lootInput === 'string' ? parsed.lootInput : '',
      lootList: Array.isArray(parsed.lootList) ? parsed.lootList : [],
    };
  } catch {
    return null;
  }
};

export default function RollCallsPage() {
  const t = useTranslations('rollCall');
  const nav = useTranslations('dashboardLayout');
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();

  const [rollCalls, setRollCalls] = React.useState<RollCall[]>([]);
  const rollCallsState = useLoadState();
  const notify = useToast();
  const createModalState = useOverlayState();
  const [isCreating, setIsCreating] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    rollCallsState.reset();
    setReloadKey(key => key + 1);
  }, [rollCallsState.reset]);
  const refetchRollCalls = React.useCallback(() => {
    apiClient
      .listRollCalls(guildId)
      .then(data => {
        setRollCalls(data);
        rollCallsState.ready();
      })
      .catch(() => {
        rollCallsState.failed();
        notify.loadFailed(reload, 'rollCalls');
      });
  }, [guildId, notify, reload, rollCallsState.ready, rollCallsState.failed]);
  React.useEffect(() => {
    refetchRollCalls();
  }, [refetchRollCalls, reloadKey]);
  useLiveResource(['rollCall'], refetchRollCalls, { guildId });

  const [activeTab, setActiveTab] = React.useState<string>('all');
  const tabLabels: Record<string, string> = {
    all: t('all'),
    open: t('statusActive'),
    finished: t('statusEnded'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  const countFor = (status: RollCallStatus | null) =>
    status === null ? rollCalls.length : rollCalls.filter(c => c.status === status).length;
  const activeStatus = STATUS_TABS.find(tab => tab.id === activeTab)?.status ?? null;
  const filtered = activeStatus === null ? rollCalls : rollCalls.filter(c => c.status === activeStatus);

  const [draft, setDraft] = React.useState<RollCallDraft>(emptyDraft);
  const [showCreateErrors, setShowCreateErrors] = React.useState(false);

  const draftErrors = useRollCallFormErrors(draft);

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

  const [templates, setTemplates] = React.useState<RollCallTemplate[]>([]);
  const [itemTemplates, setItemTemplates] = React.useState<ItemTemplate[]>([]);
  const [templatesState, setTemplatesState] = React.useState<'loading' | 'ready' | 'failed' | 'hidden'>('loading');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<Key | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setTemplatesState('loading');
    try {
      const [rollCallList, itemList] = await Promise.all([
        apiClient.listRollCallTemplates(guildId),
        apiClient.listItemTemplates(guildId),
      ]);
      setTemplates(rollCallList);
      setItemTemplates(itemList);
      setTemplatesState('ready');
    } catch (err) {
      setTemplatesState(apiErrorCode(err) === GrpcCode.PermissionDenied ? 'hidden' : 'failed');
    }
  }, [guildId]);

  React.useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTemplateChange = (key: Key | null) => {
    setSelectedTemplateId(key);
    const template = templates.find(tpl => tpl.id === key);
    if (!template) return;
    updateDraft({
      title: template.title,
      lootInput: '',
      lootList: [...template.items.map(toLootEntry), ...draft.lootList.filter(entry => entry.kind === 'gold')],
    });
  };

  const handleItemTemplatePick = (item: ItemTemplate) => {
    updateDraft({ lootList: [...draft.lootList, toLootEntry(item)] });
  };

  const openCreateModal = () => {
    const restored = readStoredDraft() ?? draft;
    const datetime = restored.datetime || currentMinute();
    persistDraft({ ...restored, datetime, expireTime: restored.expireTime || defaultExpireTime(datetime) });
    setShowCreateErrors(false);
    createModalState.open();
  };

  const handleDatetimeChange = (datetime: string) => {
    const expireFollowsDefault =
      !draft.expireTime || (draft.datetime !== '' && draft.expireTime === defaultExpireTime(draft.datetime));
    updateDraft(
      datetime && expireFollowsDefault ? { datetime, expireTime: defaultExpireTime(datetime) } : { datetime },
    );
  };

  const handleNewSubmit = async (trigger: Element) => {
    if (hasRollCallFormErrors(draftErrors)) {
      setShowCreateErrors(true);
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
        imageUrl: draft.imageUrl || undefined,
        lootList: draft.lootList,
      });
      refetchRollCalls();
      setDraft(emptyDraft);
      setSelectedTemplateId(null);
      clearStoredDraft();
      notify.success(t('createSuccess'));
      createModalState.close();
    } catch {
      notify.error(t('createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewCancel = () => {
    setDraft(emptyDraft);
    setSelectedTemplateId(null);
    clearStoredDraft();
  };

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{nav('rollCall')}</h1>
      {can('createRollCall') && (
        <Modal state={createModalState}>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="flex-row items-center gap-2 pr-8">
                  <Icon icon="solar:add-circle-linear" width={18} className="shrink-0" />
                  <Modal.Heading>{t('addRollCall')}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <RollCallFormFields
                    values={draft}
                    errors={draftErrors}
                    showErrors={showCreateErrors}
                    onChange={updateDraft}
                    onDatetimeChange={handleDatetimeChange}
                    header={templatesState !== 'hidden' && (
                      <div className="flex flex-col gap-1">
                        <Select
                          placeholder={
                            templatesState === 'loading'
                              ? t('templatesLoading')
                              : templatesState === 'ready' && templates.length === 0
                                ? t('noTemplates')
                                : t('templatePlaceholder')
                          }
                          value={selectedTemplateId}
                          onChange={handleTemplateChange}
                          isDisabled={templatesState !== 'ready' || templates.length === 0}
                        >
                          <Label>{t('template')}</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {templates.map(template => (
                                <ListBox.Item key={template.id} id={template.id} textValue={template.name}>
                                  <div className="flex min-w-0 flex-col">
                                    <span className="truncate">{template.name}</span>
                                    <span className="type-caption text-hint truncate">
                                      {t('templateSummary', { title: template.title, count: template.items.length })}
                                    </span>
                                  </div>
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                          <Description className={templatesState === 'failed' ? 'text-danger' : undefined}>
                            {templatesState === 'failed' ? t('templatesLoadFailed') : t('templateHint')}
                          </Description>
                        </Select>
                        {templatesState === 'failed' && (
                          <Button size="sm" variant="tertiary" className="self-start" onPress={loadTemplates}>
                            {t('templatesRetry')}
                          </Button>
                        )}
                      </div>
                    )}
                    loot={
                      <>
                        <LootListEditor
                          items={draft.lootList}
                          inputValue={draft.lootInput}
                          onChange={(lootList, lootInput) => updateDraft({ lootList, lootInput })}
                        >
                          {templatesState !== 'hidden' && (
                            <ItemTemplatePicker
                              templates={itemTemplates}
                              onPick={handleItemTemplatePick}
                              isDisabled={templatesState !== 'ready'}
                              placeholder={
                                templatesState === 'loading'
                                  ? t('templatesLoading')
                                  : itemTemplates.length === 0
                                    ? t('noItemTemplates')
                                    : t('itemTemplatePlaceholder')
                              }
                              description={t('itemTemplateHint')}
                            />
                          )}
                        </LootListEditor>
                        {draft.lootList.length > 0 && (
                          <p className="type-caption text-hint -mt-2">{t('lootToBankHint')}</p>
                        )}
                        {draft.lootList.some(entry => entry.kind === 'gold') && (
                          <p className="type-caption text-hint -mt-2">{t('goldToVaultHint')}</p>
                        )}
                      </>
                    }
                    footer={<p className="type-caption text-hint px-1">{t('draftSaved')}</p>}
                  />
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary" onPress={handleNewCancel}>
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    onPress={e => handleNewSubmit(e.target)}
                    isPending={isCreating}
                  >
                    {t('create')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}

      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <div className="flex items-center gap-3">
          <Tabs.ListContainer className="min-w-0 flex-1">
            <Tabs.List aria-label={t('rollCalls')}>
              {STATUS_TABS.map(tab => (
                <Tabs.Tab key={tab.id} id={tab.id} className="max-sm:h-9">
                  <div className="flex items-center gap-2">
                    <span>{tabLabels[tab.id]}</span>
                    <Chip
                      size="sm"
                      color={tab.status === null ? 'default' : rollCallStatusColor[tab.status]}
                      variant="secondary"
                    >
                      {countFor(tab.status)}
                    </Chip>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {can('createRollCall') && (
            <Button className="shrink-0 md:h-10 max-sm:size-11 max-sm:px-0" aria-label={t('addRollCall')} onPress={openCreateModal}>
              <Icon icon="solar:add-circle-linear" width={16} className="max-sm:hidden" />
              <Icon icon="solar:add-linear" width={20} className="sm:hidden" />
              <span className="max-sm:hidden">{t('addRollCall')}</span>
            </Button>
          )}
        </div>
        {STATUS_TABS.map(tab => (
          <Tabs.Panel key={tab.id} id={tab.id} className="pt-4">
            <AsyncContent
              state={rollCallsState.state}
              onRetry={reload}
              skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
            >
            {filtered.length === 0 ? (
              <Card className="border border-transparent shadow-edge bg-surface">
                <Card.Content>
                  <EmptyContent
                    icon="heroicons:clipboard-document-check"
                    title={t('noRollCalls')}
                    description={t('noRollCallsHint')}
                  />
                </Card.Content>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(item => (
                  <RollCallCard
                    key={item.id}
                    status={item.status}
                    date={item.date}
                    title={item.title}
                    expireTime={item.expireTime}
                    attendanceCount={item.attendanceCount}
                    lootCount={item.lootList.length}
                    goldLoot={item.goldLoot?.total}
                    imageUrl={item.imageUrl}
                    isDisabled={item.isDisabled}
                    href={`/dashboard/roll-calls/${item.id}`}
                  />
                ))}
              </div>
            )}
            </AsyncContent>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
