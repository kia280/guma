'use client';

import React from 'react';
import { Button, Modal, Input, TextArea, TextField, Label, Description, DatePicker, DateField, Calendar } from '@heroui/react';
import type { DateValue } from '@internationalized/date';
import { parseAbsoluteToLocal, getLocalTimeZone } from '@internationalized/date';
import { CheckinCard } from './CheckinCard';
import { CheckinStatus, CheckinEntry, mockCheckins } from './data';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';

const DRAFT_KEY = 'checkin_draft';

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

  const [checkins, setCheckins] = React.useState<CheckinEntry[]>(mockCheckins);
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

  const handleAddLoot = () => {
    const name = draft.lootInput.trim();
    if (!name) return;
    updateDraft({ lootInput: '', lootList: [...draft.lootList, name] });
  };

  const handleRemoveLoot = (idx: number) => {
    updateDraft({ lootList: draft.lootList.filter((_, i) => i !== idx) });
  };

  const handleNewSubmit = () => {
    if (!draft.title.trim()) return;
    const newEntry: CheckinEntry = {
      id: `ci-${Date.now()}`,
      status: CheckinStatus.OPEN,
      date: draft.datetime
        ? new Date(draft.datetime).toLocaleString()
        : new Date().toLocaleString(),
      description: draft.title,
      expireTime: draft.expireTime ? new Date(draft.expireTime).toISOString() : undefined,
      attendanceList: [],
      lootList: draft.lootList.map((name, i) => ({ id: `l-${Date.now()}-${i}`, name })),
      imageUrl: draft.imageUrl || undefined,
    };
    setCheckins(prev => [newEntry, ...prev]);
    setDraft(emptyDraft);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleNewCancel = () => {
    setDraft(emptyDraft);
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleCardClick = (item: CheckinEntry) => {
    router.push(`/dashboard/checkin/${item.id}`);
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
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium text-foreground">{t('lootList')}</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder={t('itemNamePlaceholder')}
                          value={draft.lootInput}
                          onChange={e => updateDraft({ lootInput: e.target.value })}
                          variant="secondary"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddLoot();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          isIconOnly
                          onPress={handleAddLoot}
                          isDisabled={!draft.lootInput.trim()}
                        >
                          <Icon icon="solar:add-circle-linear" width={16} />
                        </Button>
                      </div>
                      {draft.lootList.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {draft.lootList.map((name, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-secondary border border-divider"
                            >
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:box-linear" width={14} className="text-foreground/40" />
                                <span className="text-sm text-foreground">{name}</span>
                              </div>
                              <Button
                                size="sm"
                                isIconOnly
                                variant="tertiary"
                                className="text-foreground/40 hover:text-danger"
                                onPress={() => handleRemoveLoot(idx)}
                              >
                                <Icon icon="solar:close-circle-linear" width={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <TextField>
                      <Label>{t('imageUrlPlaceholder')}</Label>
                      <Input
                        placeholder="https://..."
                        value={draft.imageUrl}
                        onChange={e => updateDraft({ imageUrl: e.target.value })}
                        variant="secondary"
                      />
                    </TextField>
                    <p className="text-xs text-foreground/40 px-1">{t('draftSaved')}</p>
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
                    isDisabled={!draft.title.trim()}
                  >
                    {t('create')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {checkins.map(item => (
          <CheckinCard
            key={item.id}
            status={item.status}
            date={item.date}
            description={item.description}
            expireTime={item.expireTime}
            attendanceCount={item.attendanceList.length}
            lootCount={item.lootList.length}
            isDisabled={item.isDisabled}
            onClick={() => !item.isDisabled && handleCardClick(item)}
          />
        ))}
      </div>

    </div>
  );
}
