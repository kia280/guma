'use client';

import React from 'react';
import { Button, Card, Chip, Modal, Input, Tabs, TextArea, TextField, Label, Description, DatePicker, DateField, Calendar, ListBox, Select, type Key } from '@heroui/react';
import type { DateValue } from '@internationalized/date';
import { parseAbsoluteToLocal, getLocalTimeZone } from '@internationalized/date';
import { CheckinCard, checkinStatusColor } from './CheckinCard';
import { CheckinStatus, type CheckinEntry, type CheckinTemplate } from '@/types/checkin';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { LootListEditor } from '@/components/LootListEditor';

const DRAFT_KEY = 'checkin_draft';

const STATUS_TABS = [
  { id: 'all', status: null },
  { id: 'open', status: CheckinStatus.OPEN },
  { id: 'finished', status: CheckinStatus.FINISHED },
  { id: 'closed', status: CheckinStatus.CLOSED },
] as const;

interface CheckinDraft {
  title: string;
  description: string;
  datetime: string;
  expireTime: string;
  imageUrl: string;
  lootInput: string;
  lootList: string[];
}

const emptyDraft: CheckinDraft = {
  title: '',
  description: '',
  datetime: '',
  expireTime: '',
  imageUrl: '',
  lootInput: '',
  lootList: [],
};

export default function CheckinPage() {
  const t = useTranslations('checkIn');
  const router = useRouter();
  const guildId = useCurrentGuildId();

  const [checkins, setCheckins] = React.useState<CheckinEntry[]>([]);
  const refetchCheckins = React.useCallback(() => {
    apiClient.listCheckins(guildId).then(setCheckins).catch(() => {});
  }, [guildId]);
  React.useEffect(() => {
    refetchCheckins();
  }, [refetchCheckins]);

  const [activeTab, setActiveTab] = React.useState<string>('all');
  const tabLabels: Record<string, string> = {
    all: t('all'),
    open: t('statusActive'),
    finished: t('statusCompleted'),
    closed: t('statusClosed'),
  };
  const countFor = (status: CheckinStatus | null) =>
    status === null ? checkins.length : checkins.filter(c => c.status === status).length;
  const activeStatus = STATUS_TABS.find(tab => tab.id === activeTab)?.status ?? null;
  const filtered = activeStatus === null ? checkins : checkins.filter(c => c.status === activeStatus);

  const [draft, setDraft] = React.useState<CheckinDraft>(emptyDraft);

  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateDraft = (updates: Partial<CheckinDraft>) => {
    const newDraft = { ...draft, ...updates };
    setDraft(newDraft);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(newDraft));
    }, 500);
  };

  const [templates, setTemplates] = React.useState<CheckinTemplate[]>([]);
  const [templatesState, setTemplatesState] = React.useState<'loading' | 'ready' | 'failed' | 'hidden'>('loading');
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<Key | null>(null);

  const loadTemplates = React.useCallback(async () => {
    setTemplatesState('loading');
    try {
      setTemplates(await apiClient.listCheckinTemplates(guildId));
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
      lootList: template.lootList.map(item => item.name),
    });
  };

  const handleNewSubmit = async () => {
    if (!draft.title.trim() || !draft.datetime || !draft.expireTime) return;
    if (new Date(draft.expireTime) <= new Date(draft.datetime)) return;
    try {
      await apiClient.createCheckin(guildId, {
        title: draft.title,
        description: draft.description || undefined,
        datetime: draft.datetime,
        expireTime: draft.expireTime,
        imageUrl: draft.imageUrl || undefined,
        lootList: draft.lootList.map(name => ({ name })),
      });
      refetchCheckins();
      setDraft(emptyDraft);
      setSelectedTemplateId(null);
      localStorage.removeItem(DRAFT_KEY);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewCancel = () => {
    setDraft(emptyDraft);
    setSelectedTemplateId(null);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleCardClick = (item: CheckinEntry) => {
    router.push(`/dashboard/attendance/${item.id}`);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Modal>
          <Button>
            <Icon icon="solar:add-circle-linear" width={16} />
            {t('addCheckIn')}
          </Button>
          <Modal.Backdrop>
            <Modal.Container size="md">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="text-center items-center">
                  <Icon icon="solar:add-circle-linear" width={18} />
                  {t('addCheckIn')}
                </Modal.Header>
                <Modal.Body className="p-1">
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
                                      {t('templateSummary', { title: template.title, count: template.lootList.length })}
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
                    <TextField>
                      <Label>{t('title')}</Label>
                      <Input
                        placeholder={t('titlePlaceholder')}
                        value={draft.title}
                        onChange={e => updateDraft({ title: e.target.value })}
                        variant="secondary"
                        autoFocus
                      />
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
                      granularity="minute"
                      hourCycle={24}
                      value={draft.datetime ? parseAbsoluteToLocal(new Date(draft.datetime).toISOString()) : null}
                      onChange={(val: DateValue | null) => {
                        updateDraft({ datetime: val ? val.toDate(getLocalTimeZone()).toISOString() : '' });
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
                    />

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
                    slot="close"
                    onPress={handleNewSubmit}
                    isDisabled={
                      !draft.title.trim() ||
                      !draft.datetime ||
                      !draft.expireTime ||
                      new Date(draft.expireTime) <= new Date(draft.datetime)
                    }
                  >
                    {t('create')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </div>

      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <Tabs.ListContainer>
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
        {STATUS_TABS.map(tab => (
          <Tabs.Panel key={tab.id} id={tab.id} className="pt-4">
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
                    attendanceCount={item.attendanceList.length}
                    lootCount={item.lootList.length}
                    imageUrl={item.imageUrl}
                    isDisabled={item.isDisabled}
                    onClick={() => !item.isDisabled && handleCardClick(item)}
                  />
                ))}
              </div>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
