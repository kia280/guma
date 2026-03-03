'use client';

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Spinner,
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useGuildEvents } from '@/hooks/useGuildEvents';
import { GuildCalendar } from '@/components/GuildCalendar';
import { EventFormModal } from '@/components/EventFormModal';
import {
  GuildEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from '@/types/guild-events';

export default function CalendarPage() {
  const t = useTranslations('calendarPage');
  const {
    events,
    isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
    calendarView,
    navigateCalendar,
    setCalendarDate,
    setViewType,
    isCreating,
    isUpdating,
    isDeleting,
  } = useGuildEvents();

  const [selectedEvent, setSelectedEvent] = useState<GuildEvent | null>(null);

  // Modal controls
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    onFormOpen();
  };

  const handleEditEvent = (event: GuildEvent) => {
    setSelectedEvent(event);
    onFormOpen();
  };

  const handleEventClick = (event: GuildEvent) => {
    setSelectedEvent(event);
    onDetailOpen();
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      try {
        await deleteEvent(selectedEvent.id);
        onDeleteClose();
        onDetailClose();
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (selectedEvent) {
        await updateEvent({ ...data, id: selectedEvent.id });
      } else {
        await createEvent(data);
      }
      onFormClose();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const formatEventTime = (event: GuildEvent) => {
    if (event.isAllDay) return t('allDay');

    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    if (end && !event.isAllDay) {
      return `${start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${end.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }

    return start.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEventDate = (event: GuildEvent) => {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    if (end && start.toDateString() !== end.toDateString()) {
      return `${start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })} - ${end.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}`;
    }

    return start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" color="primary" />
          <p className="text-sm text-default-500">{t('loadingEvents')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end">
        <Button
          color="primary"
          startContent={<Icon icon="solar:add-circle-linear" width={16} />}
          onPress={handleCreateEvent}
        >
          {t('createEvent')}
        </Button>
      </div>

      {/* Calendar */}
      <GuildCalendar
        events={events}
        currentDate={calendarView.currentDate}
        view={calendarView.view}
        onDateChange={setCalendarDate}
        onViewChange={setViewType}
        onNavigate={navigateCalendar}
        onEventClick={handleEventClick}
      />

      {/* Event Form Modal */}
      <EventFormModal
        isOpen={isFormOpen}
        onClose={onFormClose}
        onSubmit={handleFormSubmit}
        event={selectedEvent}
        isLoading={isCreating || isUpdating}
      />

      {/* Event Detail Modal */}
      {selectedEvent && (
        <Modal isOpen={isDetailOpen} onClose={onDetailClose} size="lg" placement="top-center">
          <ModalContent>
            <ModalHeader className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">
                  {selectedEvent.title}
                </p>
                <div className="flex items-center gap-2">
                  <Chip
                    color={EVENT_TYPE_COLORS[selectedEvent.type] as any}
                    size="sm"
                    variant="flat"
                  >
                    {EVENT_TYPE_LABELS[selectedEvent.type]}
                  </Chip>
                  <Chip
                    color={PRIORITY_COLORS[selectedEvent.priority] as any}
                    size="sm"
                    variant="dot"
                  >
                    {PRIORITY_LABELS[selectedEvent.priority]}
                  </Chip>
                </div>
              </div>

              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly variant="light" size="sm" aria-label="Event actions">
                    <Icon icon="solar:menu-dots-bold" width={16} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu>
                  <DropdownItem
                    key="edit"
                    startContent={<Icon icon="solar:pen-linear" width={16} />}
                    onPress={() => {
                      onDetailClose();
                      handleEditEvent(selectedEvent);
                    }}
                  >
                    {t('editEvent')}
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    startContent={<Icon icon="solar:trash-bin-trash-linear" width={16} />}
                    onPress={onDeleteOpen}
                  >
                    {t('deleteEvent')}
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </ModalHeader>

            <ModalBody className="pb-6">
              <div className="space-y-4">
                {selectedEvent.description && (
                  <div>
                    <p className="text-default-500">{selectedEvent.description}</p>
                  </div>
                )}

                <Divider />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-small">
                    <Icon
                      icon="solar:clock-circle-linear"
                      width={16}
                      className="text-default-400"
                    />
                    <div>
                      <div className="font-medium">{formatEventDate(selectedEvent)}</div>
                      <div className="text-default-500">{formatEventTime(selectedEvent)}</div>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 text-small">
                      <Icon icon="solar:map-point-linear" width={16} className="text-default-400" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}

                  {selectedEvent.isRecurring && (
                    <div className="flex items-center gap-3 text-small">
                      <Icon icon="solar:refresh-linear" width={16} className="text-default-400" />
                      <span>
                        {t('repeats')} {selectedEvent.recurringPattern?.type}
                        {selectedEvent.recurringPattern?.interval &&
                        selectedEvent.recurringPattern.interval > 1
                          ? ` (${t('every')} ${selectedEvent.recurringPattern.interval} ${selectedEvent.recurringPattern.type}s)`
                          : ''}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-small text-default-500">
                    <Icon icon="solar:users-group-rounded-linear" width={16} />
                    <span>
                      {t('createdBy')} {selectedEvent.createdBy}
                    </span>
                  </div>
                </div>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm" placement="top-center">
        <ModalContent>
          <ModalHeader>{t('deleteEvent')}</ModalHeader>
          <ModalBody>
            <p>{t('deleteConfirm')}</p>
            {selectedEvent && (
              <div className="mt-3 p-3 bg-danger/10 border border-danger/20 rounded-lg">
                <p className="text-sm font-medium text-danger">{selectedEvent.title}</p>
                <p className="text-xs text-danger/60 mt-0.5">{formatEventDate(selectedEvent)}</p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onDeleteClose}>
              {t('cancel')}
            </Button>
            <Button color="danger" onPress={handleDeleteEvent} isLoading={isDeleting}>
              {t('deleteEvent')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
