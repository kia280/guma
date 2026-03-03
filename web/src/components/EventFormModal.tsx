'use client';

import React, { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Switch,
  Chip,
} from '@heroui/react';
import { useForm, Controller } from 'react-hook-form';
import {
  GuildEvent,
  CreateEventData,
  UpdateEventData,
  EventType,
  EventPriority,
  EVENT_TYPE_LABELS,
  PRIORITY_LABELS,
  EVENT_TYPE_COLORS,
  PRIORITY_COLORS,
} from '@/types/guild-events';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  event,
  isLoading = false,
}) => {
  const t = useTranslations('eventFormModal');
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      type: 'other' as EventType,
      startDate: new Date().toISOString().split('T')[0],
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
        startDate: startDate.toISOString().split('T')[0],
        startTime: startDate.toTimeString().slice(0, 5),
        endDate: endDate ? endDate.toISOString().split('T')[0] : '',
        endTime: endDate ? endDate.toTimeString().slice(0, 5) : '10:00',
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
        startDate: new Date().toISOString().split('T')[0],
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

  const onFormSubmit = async (data: FormData) => {
    try {
      const startDateTime = data.isAllDay
        ? `${data.startDate}T00:00:00.000Z`
        : `${data.startDate}T${data.startTime}:00.000Z`;

      let endDateTime = undefined;
      if (data.endDate) {
        endDateTime = data.isAllDay
          ? `${data.endDate}T23:59:59.999Z`
          : `${data.endDate}T${data.endTime}:00.000Z`;
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
      onClose();
    } catch (error) {
      console.error('Error submitting event:', error);
    }
  };

  const eventTypeOptions = Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => ({
    key: key as EventType,
    label,
    color: EVENT_TYPE_COLORS[key as EventType],
  }));

  const priorityOptions = Object.entries(PRIORITY_LABELS).map(([key, label]) => ({
    key: key as EventPriority,
    label,
    color: PRIORITY_COLORS[key as EventPriority],
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      placement="top-center"
      classNames={{
        base: 'max-h-[90vh]',
        body: 'py-4 overflow-y-auto',
        header: 'pb-2 border-b border-divider',
        footer: 'pt-2 border-t border-divider',
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="contents">
          <ModalHeader>
            <h3 className="text-base font-semibold">
              {event ? t('editEvent') : t('createNewEvent')}
            </h3>
          </ModalHeader>

          <ModalBody className="gap-4">
            {/* Title */}
            <Controller
              name="title"
              control={control}
              rules={{ required: t('titleRequired') }}
              render={({ field }) => (
                <Input
                  {...field}
                  label={t('title')}
                  placeholder={t('titlePlaceholder')}
                  isRequired
                  errorMessage={errors.title?.message}
                  isInvalid={!!errors.title}
                />
              )}
            />

            {/* Description */}
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  label={t('description')}
                  placeholder={t('descriptionPlaceholder')}
                  minRows={2}
                  maxRows={4}
                />
              )}
            />

            {/* Type + Priority */}
            <div className="flex gap-3">
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label={t('eventType')}
                    placeholder={t('selectType')}
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={keys => {
                      const selectedKey = Array.from(keys)[0] as EventType;
                      field.onChange(selectedKey);
                    }}
                    className="flex-1"
                    renderValue={items =>
                      items.map(item => (
                        <Chip
                          key={item.key}
                          color={EVENT_TYPE_COLORS[item.key as EventType] as any}
                          size="sm"
                          variant="flat"
                        >
                          {EVENT_TYPE_LABELS[item.key as EventType]}
                        </Chip>
                      ))
                    }
                  >
                    {eventTypeOptions.map(option => (
                      <SelectItem key={option.key}>
                        <Chip color={option.color as any} size="sm" variant="flat">
                          {option.label}
                        </Chip>
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />

              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label={t('priority')}
                    placeholder={t('selectPriority')}
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={keys => {
                      const selectedKey = Array.from(keys)[0] as EventPriority;
                      field.onChange(selectedKey);
                    }}
                    className="flex-1"
                    renderValue={items =>
                      items.map(item => (
                        <Chip
                          key={item.key}
                          color={PRIORITY_COLORS[item.key as EventPriority] as any}
                          size="sm"
                          variant="flat"
                        >
                          {PRIORITY_LABELS[item.key as EventPriority]}
                        </Chip>
                      ))
                    }
                  >
                    {priorityOptions.map(option => (
                      <SelectItem key={option.key}>
                        <Chip color={option.color as any} size="sm" variant="flat">
                          {option.label}
                        </Chip>
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />
            </div>

            {/* All Day Toggle */}
            <Controller
              name="isAllDay"
              control={control}
              render={({ field }) => (
                <Switch isSelected={field.value} onValueChange={field.onChange} color="primary">
                  {t('allDayEvent')}
                </Switch>
              )}
            />

            {/* Start Date/Time */}
            <div className="flex gap-3">
              <Controller
                name="startDate"
                control={control}
                rules={{ required: t('startDateRequired') }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    label={t('startDate')}
                    isRequired
                    errorMessage={errors.startDate?.message}
                    isInvalid={!!errors.startDate}
                    className="flex-1"
                  />
                )}
              />
              {!isAllDay && (
                <Controller
                  name="startTime"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} type="time" label={t('startTime')} className="flex-1" />
                  )}
                />
              )}
            </div>

            {/* End Date/Time */}
            <div className="flex gap-3">
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <Input {...field} type="date" label={t('endDateOptional')} className="flex-1" />
                )}
              />
              {!isAllDay && (
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} type="time" label={t('endTime')} className="flex-1" />
                  )}
                />
              )}
            </div>

            {/* Location */}
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <Input {...field} label={t('location')} placeholder={t('locationPlaceholder')} />
              )}
            />

            {/* Recurring Toggle */}
            <Controller
              name="isRecurring"
              control={control}
              render={({ field }) => (
                <Switch isSelected={field.value} onValueChange={field.onChange} color="primary">
                  {t('recurringEvent')}
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
                    <Select
                      {...field}
                      label={t('repeat')}
                      selectedKeys={field.value ? [field.value] : []}
                      onSelectionChange={keys => {
                        const selectedKey = Array.from(keys)[0] as FormData['recurringType'];
                        field.onChange(selectedKey);
                      }}
                    >
                      <SelectItem key="daily">{t('daily')}</SelectItem>
                      <SelectItem key="weekly">{t('weekly')}</SelectItem>
                      <SelectItem key="monthly">{t('monthly')}</SelectItem>
                      <SelectItem key="custom">{t('customInterval')}</SelectItem>
                    </Select>
                  )}
                />

                {/* Interval: N for daily/weekly/monthly */}
                {recurringType !== 'custom' && (
                  <Controller
                    name="recurringInterval"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        type="number"
                        label={
                          recurringType === 'daily'
                            ? t('everyNDays')
                            : recurringType === 'weekly'
                              ? t('everyNWeeks')
                              : t('everyNMonths')
                        }
                        min={1}
                        max={365}
                        value={field.value?.toString() || '1'}
                        onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                      />
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
                        <Input
                          {...field}
                          type="number"
                          label={t('hours')}
                          min={0}
                          max={23}
                          value={field.value?.toString() ?? '0'}
                          onChange={e =>
                            field.onChange(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))
                          }
                          className="flex-1"
                        />
                      )}
                    />
                    <span className="pb-3 text-default-400 text-lg font-semibold">:</span>
                    <Controller
                      name="recurringMinutes"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          label={t('minutes')}
                          min={0}
                          max={59}
                          value={field.value?.toString() ?? '30'}
                          onChange={e =>
                            field.onChange(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                          }
                          className="flex-1"
                        />
                      )}
                    />
                    <span className="pb-3 text-default-400 text-lg font-semibold">:</span>
                    <Controller
                      name="recurringSeconds"
                      control={control}
                      render={({ field }) => (
                        <Input
                          {...field}
                          type="number"
                          label={t('seconds')}
                          min={0}
                          max={59}
                          value={field.value?.toString() ?? '0'}
                          onChange={e =>
                            field.onChange(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))
                          }
                          className="flex-1"
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose} isDisabled={isLoading}>
              {t('cancel')}
            </Button>
            <Button color="primary" type="submit" isLoading={isLoading}>
              {event ? t('updateEvent') : t('createEvent')}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
