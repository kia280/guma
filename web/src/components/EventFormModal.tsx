'use client';

import React, { useEffect } from 'react';
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
  DatePicker,
  TimeInput,
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
  PRIORITY_COLORS 
} from '@/types/guild-events';
import { CalendarDate, Time } from '@internationalized/date';

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
  recurringType: 'daily' | 'weekly' | 'monthly';
  recurringInterval: number;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  event,
  isLoading = false,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
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
    },
  });

  const isAllDay = watch('isAllDay');
  const isRecurring = watch('isRecurring');
  const eventType = watch('type');

  // Reset form when event changes
  useEffect(() => {
    if (event) {
      const startDate = new Date(event.startDate);
      const endDate = event.endDate ? new Date(event.endDate) : null;
      
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
        recurringPattern: data.isRecurring ? {
          type: data.recurringType,
          interval: data.recurringInterval,
        } : undefined,
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
      classNames={{
        base: "max-h-[90vh]",
        body: "py-6",
        header: "pb-2",
        footer: "pt-2",
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit(onFormSubmit)}>
          <ModalHeader className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">
              {event ? 'Edit Event' : 'Create New Event'}
            </h3>
          </ModalHeader>

          <ModalBody className="gap-4">
            {/* Title */}
            <Controller
              name="title"
              control={control}
              rules={{ required: 'Title is required' }}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Title"
                  placeholder="Enter event title"
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
                  label="Description"
                  placeholder="Enter event description"
                  minRows={3}
                  maxRows={6}
                />
              )}
            />

            <div className="flex gap-4">
              {/* Event Type */}
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Event Type"
                    placeholder="Select event type"
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as EventType;
                      field.onChange(selectedKey);
                    }}
                    className="flex-1"
                    renderValue={(items) => {
                      return items.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                          <Chip
                            color={EVENT_TYPE_COLORS[item.key as EventType] as any}
                            size="sm"
                            variant="flat"
                          >
                            {EVENT_TYPE_LABELS[item.key as EventType]}
                          </Chip>
                        </div>
                      ));
                    }}
                  >
                    {eventTypeOptions.map((option) => (
                      <SelectItem key={option.key}>
                        <div className="flex items-center gap-2">
                          <Chip
                            color={option.color as any}
                            size="sm"
                            variant="flat"
                          >
                            {option.label}
                          </Chip>
                        </div>
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />

              {/* Priority */}
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select
                    {...field}
                    label="Priority"
                    placeholder="Select priority"
                    selectedKeys={field.value ? [field.value] : []}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as EventPriority;
                      field.onChange(selectedKey);
                    }}
                    className="flex-1"
                    renderValue={(items) => {
                      return items.map((item) => (
                        <div key={item.key} className="flex items-center gap-2">
                          <Chip
                            color={PRIORITY_COLORS[item.key as EventPriority] as any}
                            size="sm"
                            variant="flat"
                          >
                            {PRIORITY_LABELS[item.key as EventPriority]}
                          </Chip>
                        </div>
                      ));
                    }}
                  >
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.key}>
                        <div className="flex items-center gap-2">
                          <Chip
                            color={option.color as any}
                            size="sm"
                            variant="flat"
                          >
                            {option.label}
                          </Chip>
                        </div>
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
                <Switch
                  isSelected={field.value}
                  onValueChange={field.onChange}
                  color="primary"
                >
                  All Day Event
                </Switch>
              )}
            />

            {/* Start Date/Time */}
            <div className="flex gap-4">
              <Controller
                name="startDate"
                control={control}
                rules={{ required: 'Start date is required' }}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    label="Start Date"
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
                    <Input
                      {...field}
                      type="time"
                      label="Start Time"
                      className="flex-1"
                    />
                  )}
                />
              )}
            </div>

            {/* End Date/Time */}
            <div className="flex gap-4">
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    type="date"
                    label="End Date (Optional)"
                    className="flex-1"
                  />
                )}
              />
              
              {!isAllDay && (
                <Controller
                  name="endTime"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="time"
                      label="End Time"
                      className="flex-1"
                    />
                  )}
                />
              )}
            </div>

            {/* Location */}
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Location"
                  placeholder="Enter event location"
                />
              )}
            />

            {/* Recurring Event Toggle */}
            <Controller
              name="isRecurring"
              control={control}
              render={({ field }) => (
                <Switch
                  isSelected={field.value}
                  onValueChange={field.onChange}
                  color="primary"
                >
                  Recurring Event
                </Switch>
              )}
            />

            {/* Recurring Options */}
            {isRecurring && (
              <div className="flex gap-4">
                <Controller
                  name="recurringType"
                  control={control}
                  render={({ field }) => (
                    <Select
                      {...field}
                      label="Repeat"
                      selectedKeys={field.value ? [field.value] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as 'daily' | 'weekly' | 'monthly';
                        field.onChange(selectedKey);
                      }}
                      className="flex-1"
                    >
                      <SelectItem key="daily">Daily</SelectItem>
                      <SelectItem key="weekly">Weekly</SelectItem>
                      <SelectItem key="monthly">Monthly</SelectItem>
                    </Select>
                  )}
                />

                <Controller
                  name="recurringInterval"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="number"
                      label="Every"
                      min={1}
                      max={365}
                      value={field.value?.toString() || '1'}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      className="flex-1"
                    />
                  )}
                />
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button
              color="danger"
              variant="light"
              onPress={onClose}
              isDisabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={isLoading}
            >
              {event ? 'Update Event' : 'Create Event'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};