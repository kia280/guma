'use client';

import {
  Modal,
  Button,
  Input,
  TextArea,
  Select,
  Switch,
  Chip,
  TextField,
  Label,
  FieldError,
  ListBox,
  DateField,
  TimeField,
  type UseOverlayStateReturn,
} from '@heroui/react';
import type { TimeValue } from '@heroui/react';
import type { DateValue } from '@internationalized/date';
import { parseDate, Time } from '@internationalized/date';
import { useTranslations } from 'next-intl';
import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useToast } from '@/hooks/useToast';
import {
  GuildEvent,
  CreateEventData,
  UpdateEventData,
  EventType,
  EventPriority,
  EVENT_TYPES,
  EVENT_PRIORITIES,
  EVENT_TYPE_COLORS,
  PRIORITY_COLORS,
} from '@/types/guild-events';

interface EventFormModalProps {
  state: UseOverlayStateReturn;
  onSubmit: (data: CreateEventData | UpdateEventData) => Promise<void>;
  event?: GuildEvent | null;
  isLoading?: boolean;
}

interface FormData {
  title: string;
  description: string;
  type: EventType;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  isAllDay: boolean;
  location: string;
  priority: EventPriority;
  isRecurring: boolean;
  recurringType: 'daily' | 'weekly' | 'monthly' | 'custom';
  recurringInterval: number;
  recurringHours: number;
  recurringMinutes: number;
  recurringSeconds: number;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

const toLocalDateInput = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toLocalTimeInput = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const localDateTimeToISO = (date: string, time: string, seconds = 0, milliseconds = 0) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds).toISOString();
};

const MIN_EVENT_DATE = parseDate('2000-01-01');
const MAX_EVENT_DATE = parseDate('2099-12-31');

const isDateInRange = (value: string) => {
  const date = parseDate(value);
  return date.compare(MIN_EVENT_DATE) >= 0 && date.compare(MAX_EVENT_DATE) <= 0;
};

const isEndAfterStart = ({ isAllDay, startDate, startTime, endDate, endTime }: FormData) => {
  if (!startDate || !endDate) return true;
  if (isAllDay) return parseDate(endDate).compare(parseDate(startDate)) >= 0;
  return localDateTimeToISO(endDate, endTime) > localDateTimeToISO(startDate, startTime);
};

export const EventFormModal: React.FC<EventFormModalProps> = ({
  state,
  onSubmit,
  event,
  isLoading = false,
}) => {
  const t = useTranslations('eventFormModal');
  const notify = useToast();
  const eventLabels = useTranslations('guildEvents');
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: 'onChange',
    defaultValues: {
      title: '',
      description: '',
      type: 'other' as EventType,
      startDate: toLocalDateInput(new Date()),
      startTime: '09:00',
      endDate: '',
      endTime: '10:00',
      isAllDay: false,
      location: '',
      priority: 'medium' as EventPriority,
      isRecurring: false,
      recurringType: 'weekly',
      recurringInterval: 1,
      recurringHours: 0,
      recurringMinutes: 30,
      recurringSeconds: 0,
    },
  });

  const isAllDay = watch('isAllDay');
  const isRecurring = watch('isRecurring');
  const recurringType = watch('recurringType');

  useEffect(() => {
    if (event) {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : null;
      const custom = event.recurringPattern?.customInterval;

      reset({
        title: event.title,
        description: event.description || '',
        type: event.type,
        startDate: toLocalDateInput(startDate),
        startTime: toLocalTimeInput(startDate),
        endDate: endDate ? toLocalDateInput(endDate) : '',
        endTime: endDate ? toLocalTimeInput(endDate) : '10:00',
        isAllDay: event.isAllDay,
        location: event.location || '',
        priority: event.priority,
        isRecurring: event.isRecurring,
        recurringType: event.recurringPattern?.type || 'weekly',
        recurringInterval: event.recurringPattern?.interval || 1,
        recurringHours: custom?.hours ?? 0,
        recurringMinutes: custom?.minutes ?? 30,
        recurringSeconds: custom?.seconds ?? 0,
      });
    } else {
      reset({
        title: '',
        description: '',
        type: 'other',
        startDate: toLocalDateInput(new Date()),
        startTime: '09:00',
        endDate: '',
        endTime: '10:00',
        isAllDay: false,
        location: '',
        priority: 'medium',
        isRecurring: false,
        recurringType: 'weekly',
        recurringInterval: 1,
        recurringHours: 0,
        recurringMinutes: 30,
        recurringSeconds: 0,
      });
    }
  }, [event, reset]);

  const dateRangeMessage = t('dateOutOfRange', {
    min: MIN_EVENT_DATE.year,
    max: MAX_EVENT_DATE.year,
  });

  const onFormSubmit = async (data: FormData) => {
    try {
      const startDateTime = data.isAllDay
        ? localDateTimeToISO(data.startDate, '00:00')
        : localDateTimeToISO(data.startDate, data.startTime);

      let endDateTime = undefined;
      if (data.endDate) {
        endDateTime = data.isAllDay
          ? localDateTimeToISO(data.endDate, '23:59', 59, 999)
          : localDateTimeToISO(data.endDate, data.endTime);
      }

      const eventData: CreateEventData | UpdateEventData = {
        ...(event && { id: event.id }),
        title: data.title,
        description: data.description || undefined,
        type: data.type,
        startDate: startDateTime,
        endDate: endDateTime,
        isAllDay: data.isAllDay,
        location: data.location || undefined,
        priority: data.priority,
        isRecurring: data.isRecurring,
        recurringPattern: data.isRecurring
          ? {
              type: data.recurringType,
              interval: data.recurringType === 'custom' ? 0 : data.recurringInterval,
              customInterval:
                data.recurringType === 'custom'
                  ? {
                      hours: data.recurringHours,
                      minutes: data.recurringMinutes,
                      seconds: data.recurringSeconds,
                    }
                  : undefined,
            }
          : undefined,
      };

      await onSubmit(eventData);
      notify.success(event ? t('updateSuccess') : t('createSuccess'));
      state.close();
    } catch {
      notify.error(t('saveFailed'));
    }
  };

  const eventTypeOptions = EVENT_TYPES.map(key => ({
    key,
    label: eventLabels(`types.${key}`),
    color: EVENT_TYPE_COLORS[key],
  }));

  const priorityOptions = EVENT_PRIORITIES.map(key => ({
    key,
    label: eventLabels(`priorities.${key}`),
    color: PRIORITY_COLORS[key],
  }));

  return (
    <Modal state={state}>
    <Modal.Backdrop>
      <Modal.Container size="lg">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <form onSubmit={handleSubmit(onFormSubmit)} className="contents">
            <Modal.Header className="text-center items-center pb-2 border-b border-divider">
              <Modal.Heading>{event ? t('editEvent') : t('createNewEvent')}</Modal.Heading>
            </Modal.Header>

            <Modal.Body className="p-1 gap-4 flex flex-col">
              {/* Title */}
              <Controller
                name="title"
                control={control}
                rules={{ required: t('titleRequired') }}
                render={({ field }) => (
                  <TextField isRequired isInvalid={!!errors.title}>
                    <Label>{t('title')}</Label>
                    <Input {...field} placeholder={t('titlePlaceholder')} />
                    <FieldError>{errors.title?.message}</FieldError>
                  </TextField>
                )}
              />

              {/* Description */}
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <TextField>
                    <Label>{t('description')}</Label>
                    <TextArea {...field} placeholder={t('descriptionPlaceholder')} rows={3} />
                  </TextField>
                )}
              />

              {/* Type + Priority */}
              <div className="flex gap-3">
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Select className="flex-1" value={field.value} onChange={field.onChange}>
                      <Label>{t('eventType')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {eventTypeOptions.map(option => (
                            <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                              <Chip color={option.color} size="sm" variant="secondary">
                                {option.label}
                              </Chip>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                />

                <Controller
                  name="priority"
                  control={control}
                  render={({ field }) => (
                    <Select className="flex-1" value={field.value} onChange={field.onChange}>
                      <Label>{t('priority')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {priorityOptions.map(option => (
                            <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                              <Chip color={option.color} size="sm" variant="secondary">
                                {option.label}
                              </Chip>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                />
              </div>

              {/* All Day Toggle */}
              <Controller
                name="isAllDay"
                control={control}
                rules={{ deps: ['endDate'] }}
                render={({ field }) => (
                  <Switch isSelected={field.value} onChange={field.onChange}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label>{t('allDayEvent')}</Label>
                    </Switch.Content>
                  </Switch>
                )}
              />

              {/* Start Date/Time */}
              <div className="flex gap-3">
                <Controller
                  name="startDate"
                  control={control}
                  rules={{
                    required: t('startDateRequired'),
                    validate: value => !value || isDateInRange(value) || dateRangeMessage,
                    deps: ['endDate'],
                  }}
                  render={({ field }) => (
                    <DateField
                      className="flex-1"
                      isRequired
                      validationBehavior="aria"
                      minValue={MIN_EVENT_DATE}
                      maxValue={MAX_EVENT_DATE}
                      isInvalid={!!errors.startDate}
                      value={field.value ? parseDate(field.value) : null}
                      onChange={(val: DateValue | null) => field.onChange(val ? val.toString() : '')}
                    >
                      <Label>{t('startDate')}</Label>
                      <DateField.Group>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                      </DateField.Group>
                      <FieldError>{errors.startDate?.message}</FieldError>
                    </DateField>
                  )}
                />
                {!isAllDay && (
                  <Controller
                    name="startTime"
                    control={control}
                    rules={{ deps: ['endDate'] }}
                    render={({ field }) => {
                      const [h, m] = (field.value || '00:00').split(':').map(Number);
                      return (
                        <TimeField
                          className="flex-1"
                          hourCycle={24}
                          value={new Time(h, m)}
                          onChange={(val: TimeValue | null) => {
                            if (val) {
                              field.onChange(`${String(val.hour).padStart(2, '0')}:${String(val.minute).padStart(2, '0')}`);
                            }
                          }}
                        >
                          <Label>{t('startTime')}</Label>
                          <TimeField.Group>
                            <TimeField.Input>
                              {(segment) => <TimeField.Segment segment={segment} />}
                            </TimeField.Input>
                          </TimeField.Group>
                        </TimeField>
                      );
                    }}
                  />
                )}
              </div>

              {/* End Date/Time */}
              <div className="flex gap-3">
                <Controller
                  name="endDate"
                  control={control}
                  rules={{
                    validate: {
                      inRange: value => !value || isDateInRange(value) || dateRangeMessage,
                      afterStart: (_, values) => isEndAfterStart(values) || t('endBeforeStart'),
                    },
                  }}
                  render={({ field }) => (
                    <DateField
                      className="flex-1"
                      validationBehavior="aria"
                      minValue={MIN_EVENT_DATE}
                      maxValue={MAX_EVENT_DATE}
                      isInvalid={!!errors.endDate}
                      value={field.value ? parseDate(field.value) : null}
                      onChange={(val: DateValue | null) => field.onChange(val ? val.toString() : '')}
                    >
                      <Label>{t('endDateOptional')}</Label>
                      <DateField.Group>
                        <DateField.Input>
                          {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                      </DateField.Group>
                      <FieldError>{errors.endDate?.message}</FieldError>
                    </DateField>
                  )}
                />
                {!isAllDay && (
                  <Controller
                    name="endTime"
                    control={control}
                    rules={{ deps: ['endDate'] }}
                    render={({ field }) => {
                      const [h, m] = (field.value || '00:00').split(':').map(Number);
                      return (
                        <TimeField
                          className="flex-1"
                          hourCycle={24}
                          value={new Time(h, m)}
                          onChange={(val: TimeValue | null) => {
                            if (val) {
                              field.onChange(`${String(val.hour).padStart(2, '0')}:${String(val.minute).padStart(2, '0')}`);
                            }
                          }}
                        >
                          <Label>{t('endTime')}</Label>
                          <TimeField.Group>
                            <TimeField.Input>
                              {(segment) => <TimeField.Segment segment={segment} />}
                            </TimeField.Input>
                          </TimeField.Group>
                        </TimeField>
                      );
                    }}
                  />
                )}
              </div>

              {/* Location */}
              <Controller
                name="location"
                control={control}
                render={({ field }) => (
                  <TextField>
                    <Label>{t('location')}</Label>
                    <Input {...field} placeholder={t('locationPlaceholder')} />
                  </TextField>
                )}
              />

              {/* Recurring Toggle */}
              <Controller
                name="isRecurring"
                control={control}
                render={({ field }) => (
                  <Switch isSelected={field.value} onChange={field.onChange}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Switch.Content>
                      <Label>{t('recurringEvent')}</Label>
                    </Switch.Content>
                  </Switch>
                )}
              />

              {/* Recurring Options */}
              {isRecurring && (
                <div className="flex flex-col gap-3 pl-1">
                  {/* Repeat type */}
                  <Controller
                    name="recurringType"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onChange={field.onChange}>
                        <Label>{t('repeat')}</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="daily" textValue={t('daily')}>
                              {t('daily')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="weekly" textValue={t('weekly')}>
                              {t('weekly')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="monthly" textValue={t('monthly')}>
                              {t('monthly')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="custom" textValue={t('customInterval')}>
                              {t('customInterval')}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    )}
                  />

                  {/* Interval: N for daily/weekly/monthly */}
                  {recurringType !== 'custom' && (
                    <Controller
                      name="recurringInterval"
                      control={control}
                      render={({ field }) => (
                        <TextField>
                          <Label>
                            {recurringType === 'daily'
                              ? t('everyNDays')
                              : recurringType === 'weekly'
                                ? t('everyNWeeks')
                                : t('everyNMonths')}
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            value={field.value?.toString() || '1'}
                            onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </TextField>
                      )}
                    />
                  )}

                  {/* Custom hh:mm:ss interval */}
                  {recurringType === 'custom' && (
                    <div className="flex gap-3 items-end">
                      <Controller
                        name="recurringHours"
                        control={control}
                        render={({ field }) => (
                          <TextField className="flex-1">
                            <Label>{t('hours')}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={23}
                              value={field.value?.toString() ?? '0'}
                              onChange={e =>
                                field.onChange(
                                  Math.min(23, Math.max(0, parseInt(e.target.value) || 0))
                                )
                              }
                            />
                          </TextField>
                        )}
                      />
                      <span className="pb-3 text-hint type-heading tabular-nums">:</span>
                      <Controller
                        name="recurringMinutes"
                        control={control}
                        render={({ field }) => (
                          <TextField className="flex-1">
                            <Label>{t('minutes')}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={field.value?.toString() ?? '30'}
                              onChange={e =>
                                field.onChange(
                                  Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                                )
                              }
                            />
                          </TextField>
                        )}
                      />
                      <span className="pb-3 text-hint type-heading tabular-nums">:</span>
                      <Controller
                        name="recurringSeconds"
                        control={control}
                        render={({ field }) => (
                          <TextField className="flex-1">
                            <Label>{t('seconds')}</Label>
                            <Input
                              type="number"
                              min={0}
                              max={59}
                              value={field.value?.toString() ?? '0'}
                              onChange={e =>
                                field.onChange(
                                  Math.min(59, Math.max(0, parseInt(e.target.value) || 0))
                                )
                              }
                            />
                          </TextField>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>

            <Modal.Footer className="pt-2 border-t border-divider">
              <Button variant="secondary" slot="close" isDisabled={isLoading}>
                {t('cancel')}
              </Button>
              <Button variant="primary" type="submit" isPending={isLoading}>
                {event ? t('updateEvent') : t('createEvent')}
              </Button>
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
    </Modal>
  );
};
