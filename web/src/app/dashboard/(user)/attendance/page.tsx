'use client';

import { Button, Card, Chip, Modal, Input, Tabs, TextArea, TextField, Label, Description, FieldError, DatePicker, DateField, Calendar, ListBox, Select, useOverlayState, type Key } from '@heroui/react';
import { Icon } from '@iconify/react';
import { parseAbsoluteToLocal, getLocalTimeZone } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton } from '@/components/AsyncContent';
import { ItemTemplatePicker } from '@/components/ItemTemplatePicker';
import { LootListEditor } from '@/components/LootListEditor';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import { checkinStatusColor } from '@/lib/status-colors';
import { CheckinStatus, type CheckinEntry, type CheckinTemplate, type ItemTemplate, type LootEntry } from '@/types/checkin';
import { CheckinCard } from './CheckinCard';

const DRAFT_KEY = 'checkin_draft';

const STATUS_TABS = [
  { id: 'all', status: null },
  { id: 'open', status: CheckinStatus.OPEN },
  { id: 'finished', status: CheckinStatus.FINISHED },
  { id: 'cancelled', status: CheckinStatus.CANCELLED },
] as const;

interface CheckinDraft {
  title: string;
  description: string;
  datetime: string;
  expireTime: string;
  imageUrl: string;
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

const emptyDraft: CheckinDraft = {
  title: '',
  description: '',
  datetime: '',
  expireTime: '',
  imageUrl: '',
  lootInput: '',
  lootList: [],
};

const readStoredDraft = (): CheckinDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckinDraft> | null;
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

export default function CheckinPage() {
  const t = useTranslations('checkIn');
  const nav = useTranslations('dashboardLayout');
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();

  const [checkins, setCheckins] = React.useState<CheckinEntry[]>([]);
  const checkinsState = useLoadState();
  const notify = useToast();
  const createModalState = useOverlayState();
  const [isCreating, setIsCreating] = React.useState(false);
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    checkinsState.reset();
    setReloadKey(key => key + 1);
  }, [checkinsState.reset]);
  const refetchCheckins = React.useCallback(() => {
    apiClient
      .listCheckins(guildId)
      .then(data => {
        setCheckins(data);
        checkinsState.ready();
      })
      .catch(() => {
        checkinsState.failed();
        notify.loadFailed(reload, 'checkins');
      });
  }, [guildId, notify, reload, checkinsState.ready, checkinsState.failed]);
  React.useEffect(() => {
    refetchCheckins();
  }, [refetchCheckins, reloadKey]);

  const [activeTab, setActiveTab] = React.useState<string>('all');
  const tabLabels: Record<string, string> = {
    all: t('all'),
    open: t('statusActive'),
    finished: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  const countFor = (status: CheckinStatus | null) =>
    status === null ? checkins.length : checkins.filter(c => c.status === status).length;
  const activeStatus = STATUS_TABS.find(tab => tab.id === activeTab)?.status ?? null;
  const filtered = activeStatus === null ? checkins : checkins.filter(c => c.status === activeStatus);

  const [draft, setDraft] = React.useState<CheckinDraft>(emptyDraft);
  const [showCreateErrors, setShowCreateErrors] = React.useState(false);

  const titleError = draft.title.trim() ? null : t('titleRequired');
  const datetimeError = draft.datetime ? null : t('eventDateTimeRequired');
  const expireBeforeStart =
    Boolean(draft.datetime && draft.expireTime) && new Date(draft.expireTime) <= new Date(draft.datetime);
  const expireTimeError = !draft.expireTime
    ? t('expireTimeRequired')
    : expireBeforeStart
      ? t('expireBeforeStart')
      : null;
  const showTitleError = Boolean(titleError) && showCreateErrors;
  const showDatetimeError = Boolean(datetimeError) && showCreateErrors;
  const showExpireTimeError = Boolean(expireTimeError) && (showCreateErrors || expireBeforeStart);

  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistDraft = (newDraft: CheckinDraft) => {
    setDraft(newDraft);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
      } catch {}
    }, 500);
  };

  const updateDraft = (updates: Partial<CheckinDraft>) => {
    persistDraft({ ...draft, ...updates });
  };

  const clearStoredDraft = () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const [templates, setTemplates] = React.useState<CheckinTemplate[]>([]);
  const [itemTemplates, setItemTemplates] = React.useState<ItemTemplate[]>([]);
  const [templatesState, setTemplatesState] = React.useState<'loading' | 'ready' | 'failed' | 'hidden'>('loading');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<Key | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setTemplatesState('loading');
    try {
      const [checkinList, itemList] = await Promise.all([
        apiClient.listCheckinTemplates(guildId),
        apiClient.listItemTemplates(guildId),
      ]);
      setTemplates(checkinList);
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
      lootList: template.items.map(toLootEntry),
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
    if (titleError || datetimeError || expireTimeError) {
      setShowCreateErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsCreating(true);
    try {
      await apiClient.createCheckin(guildId, {
        title: draft.title,
        description: draft.description || undefined,
        datetime: draft.datetime,
        expireTime: draft.expireTime,
        imageUrl: draft.imageUrl || undefined,
        lootList: draft.lootList,
      });
      refetchCheckins();
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
      <h1 className="sr-only">{nav('checkin')}</h1>
      {can('createCheckin') && (
        <Modal state={createModalState}>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="flex-row items-center gap-2 pr-8">
                  <Icon icon="solar:add-circle-linear" width={18} className="shrink-0" />
                  <Modal.Heading>{t('addCheckIn')}</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form className="flex flex-col gap-4">
                    {templatesState !== 'hidden' && (
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
                    <TextField isRequired validationBehavior="aria" isInvalid={showTitleError}>
                      <Label>{t('title')}</Label>
                      <Input
                        placeholder={t('titlePlaceholder')}
                        value={draft.title}
                        onChange={e => updateDraft({ title: e.target.value })}
                        variant="secondary"
                        autoFocus
                      />
                      {showTitleError && <FieldError>{titleError}</FieldError>}
                    </TextField>
                    <TextField>
                      <Label>{t('description')}</Label>
                      <TextArea
                        placeholder={t('descriptionPlaceholder')}
                        value={draft.description}
                        onChange={e => updateDraft({ description: e.target.value })}
                        variant="secondary"
                        rows={2}
                      />
                    </TextField>
                    <DatePicker
                      isRequired
                      validationBehavior="aria"
                      isInvalid={showDatetimeError}
                      granularity="minute"
                      hourCycle={24}
                      value={draft.datetime ? parseAbsoluteToLocal(new Date(draft.datetime).toISOString()) : null}
                      onChange={(val: DateValue | null) => {
                        handleDatetimeChange(val ? val.toDate(getLocalTimeZone()).toISOString() : '');
                      }}
                    >
                      <Label>{t('eventDateTime')}</Label>
                      <DateField.Group fullWidth>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      {showDatetimeError && <FieldError>{datetimeError}</FieldError>}
                      <DatePicker.Popover>
                        <Calendar aria-label={t('eventDateTime')}>
                          <Calendar.Header>
                            <Calendar.YearPickerTrigger>
                              <Calendar.YearPickerTriggerHeading />
                              <Calendar.YearPickerTriggerIndicator />
                            </Calendar.YearPickerTrigger>
                            <Calendar.NavButton slot="previous" />
                            <Calendar.NavButton slot="next" />
                          </Calendar.Header>
                          <Calendar.Grid>
                            <Calendar.GridHeader>
                              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>
                              {(date) => <Calendar.Cell date={date} />}
                            </Calendar.GridBody>
                          </Calendar.Grid>
                          <Calendar.YearPickerGrid>
                            <Calendar.YearPickerGridBody>
                              {({ year }) => <Calendar.YearPickerCell year={year} />}
                            </Calendar.YearPickerGridBody>
                          </Calendar.YearPickerGrid>
                        </Calendar>
                      </DatePicker.Popover>
                    </DatePicker>
                    <DatePicker
                      isRequired
                      validationBehavior="aria"
                      isInvalid={showExpireTimeError}
                      granularity="minute"
                      hourCycle={24}
                      value={draft.expireTime ? parseAbsoluteToLocal(new Date(draft.expireTime).toISOString()) : null}
                      onChange={(val: DateValue | null) => {
                        updateDraft({ expireTime: val ? val.toDate(getLocalTimeZone()).toISOString() : '' });
                      }}
                    >
                      <Label>{t('expireTime')}</Label>
                      <DateField.Group fullWidth>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateField.Suffix>
                          <DatePicker.Trigger>
                            <DatePicker.TriggerIndicator />
                          </DatePicker.Trigger>
                        </DateField.Suffix>
                      </DateField.Group>
                      <Description>{t('expirePlaceholder')}</Description>
                      {showExpireTimeError && <FieldError>{expireTimeError}</FieldError>}
                      <DatePicker.Popover>
                        <Calendar aria-label={t('expireTime')}>
                          <Calendar.Header>
                            <Calendar.YearPickerTrigger>
                              <Calendar.YearPickerTriggerHeading />
                              <Calendar.YearPickerTriggerIndicator />
                            </Calendar.YearPickerTrigger>
                            <Calendar.NavButton slot="previous" />
                            <Calendar.NavButton slot="next" />
                          </Calendar.Header>
                          <Calendar.Grid>
                            <Calendar.GridHeader>
                              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                            </Calendar.GridHeader>
                            <Calendar.GridBody>
                              {(date) => <Calendar.Cell date={date} />}
                            </Calendar.GridBody>
                          </Calendar.Grid>
                          <Calendar.YearPickerGrid>
                            <Calendar.YearPickerGridBody>
                              {({ year }) => <Calendar.YearPickerCell year={year} />}
                            </Calendar.YearPickerGridBody>
                          </Calendar.YearPickerGrid>
                        </Calendar>
                      </DatePicker.Popover>
                    </DatePicker>

                    {/* Loot list */}
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

                    <TextField>
                      <Label>{t('imageUrlPlaceholder')}</Label>
                      <Input
                        placeholder="https://..."
                        value={draft.imageUrl}
                        onChange={e => updateDraft({ imageUrl: e.target.value })}
                        variant="secondary"
                      />
                    </TextField>
                    <p className="type-caption text-hint px-1">{t('draftSaved')}</p>
                  </form>
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
            <Tabs.List aria-label={t('checkIn')}>
              {STATUS_TABS.map(tab => (
                <Tabs.Tab key={tab.id} id={tab.id}>
                  <div className="flex items-center gap-2">
                    <span>{tabLabels[tab.id]}</span>
                    <Chip
                      size="sm"
                      color={tab.status === null ? 'default' : checkinStatusColor[tab.status]}
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
          {can('createCheckin') && (
            <Button className="shrink-0 max-sm:size-11 max-sm:px-0" aria-label={t('addCheckIn')} onPress={openCreateModal}>
              <Icon icon="solar:add-circle-linear" width={16} className="max-sm:hidden" />
              <Icon icon="solar:add-linear" width={20} className="sm:hidden" />
              <span className="max-sm:hidden">{t('addCheckIn')}</span>
            </Button>
          )}
        </div>
        {STATUS_TABS.map(tab => (
          <Tabs.Panel key={tab.id} id={tab.id} className="pt-4">
            <AsyncContent
              state={checkinsState.state}
              onRetry={reload}
              skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
            >
            {filtered.length === 0 ? (
              <Card className="border border-divider shadow-none">
                <Card.Content className="text-center py-12">
                  <Icon
                    icon="heroicons:clipboard-document-check"
                    width={40}
                    className="mx-auto mb-3 text-disabled"
                  />
                  <h3 className="type-subheading mb-1 text-foreground">{t('noCheckins')}</h3>
                  <p className="type-body text-subtle">{t('noCheckinsHint')}</p>
                </Card.Content>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(item => (
                  <CheckinCard
                    key={item.id}
                    status={item.status}
                    date={item.date}
                    description={item.description}
                    expireTime={item.expireTime}
                    attendanceCount={item.attendanceCount}
                    lootCount={item.lootList.length}
                    imageUrl={item.imageUrl}
                    isDisabled={item.isDisabled}
                    href={`/dashboard/attendance/${item.id}`}
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
