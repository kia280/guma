'use client';

import { Card, Button, Dropdown, Chip, Spinner, Modal, Separator, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';
import { EventFormModal } from '@/components/EventFormModal';
import { GuildCalendar } from '@/components/GuildCalendar';
import { useGuildEvents } from '@/hooks/useGuildEvents';
import { useIntlLocale } from '@/i18n/useIntlFormatter';
import {
  GuildEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from '@/types/guild-events';

export default function CalendarPage() {
  const t = useTranslations('calendarPage');
  const intlLocale = useIntlLocale();
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
  const formModalState = useOverlayState();
  const detailModalState = useOverlayState();
  const deleteModalState = useOverlayState();

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    formModalState.open();
  };

  const handleEditEvent = (event: GuildEvent) => {
    setSelectedEvent(event);
    formModalState.open();
  };

  const handleEventClick = (event: GuildEvent) => {
    setSelectedEvent(event);
    detailModalState.open();
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      try {
        await deleteEvent(selectedEvent.id);
        deleteModalState.close();
        detailModalState.close();
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
      formModalState.close();
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const formatEventTime = (event: GuildEvent) => {
    if (event.isAllDay) return t('allDay');

    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    if (end && !event.isAllDay) {
      return `${start.toLocaleTimeString(intlLocale, {
        hour: '2-digit',
        minute: '2-digit',
      })} - ${end.toLocaleTimeString(intlLocale, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }

    return start.toLocaleTimeString(intlLocale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatEventDate = (event: GuildEvent) => {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;

    if (end && start.toDateString() !== end.toDateString()) {
      return `${start.toLocaleDateString(intlLocale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })} - ${end.toLocaleDateString(intlLocale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })}`;
    }

    return start.toLocaleDateString(intlLocale, {
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
          <Spinner size="lg" color="current" />
          <p className="type-body text-subtle">{t('loadingEvents')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex justify-end shrink-0">
        <Button variant="primary" onPress={handleCreateEvent}>
          <Icon icon="solar:add-circle-linear" width={16} />
          {t('createEvent')}
        </Button>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0">
        <GuildCalendar
          events={events}
          currentDate={calendarView.currentDate}
          view={calendarView.view}
          onDateChange={setCalendarDate}
          onViewChange={setViewType}
          onNavigate={navigateCalendar}
          onEventClick={handleEventClick}
        />
      </div>

      {/* Event Form Modal */}
      <EventFormModal
        state={formModalState}
        onSubmit={handleFormSubmit}
        event={selectedEvent}
        isLoading={isCreating || isUpdating}
      />

      {/* Event Detail Modal */}
      <Modal state={detailModalState}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            {selectedEvent && (
              <>
                <Modal.Header className="text-center items-center">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <p className="type-subheading text-foreground truncate">
                      {selectedEvent.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <Chip
                        color={EVENT_TYPE_COLORS[selectedEvent.type] as any}
                        size="sm"
                        variant="tertiary"
                      >
                        {EVENT_TYPE_LABELS[selectedEvent.type]}
                      </Chip>
                      <Chip
                        color={PRIORITY_COLORS[selectedEvent.priority] as any}
                        size="sm"
                        variant="secondary"
                      >
                        {PRIORITY_LABELS[selectedEvent.priority]}
                      </Chip>
                    </div>
                  </div>

                  <Dropdown>
                    <Button isIconOnly variant="secondary" size="sm" aria-label="Event actions">
                      <Icon icon="solar:menu-dots-bold" width={16} />
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu
                        onAction={key => {
                          if (key === 'edit') {
                            detailModalState.close();
                            handleEditEvent(selectedEvent);
                          } else if (key === 'delete') {
                            deleteModalState.open();
                          }
                        }}
                      >
                        <Dropdown.Item key="edit" textValue="Edit">
                          <Icon icon="solar:pen-linear" width={16} />
                          {t('editEvent')}
                        </Dropdown.Item>
                        <Dropdown.Item key="delete" textValue="Delete" className="text-danger">
                          <Icon icon="solar:trash-bin-trash-linear" width={16} />
                          {t('deleteEvent')}
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </Modal.Header>

                <Modal.Body className="p-1">
                  <div className="space-y-4">
                    {selectedEvent.description && (
                      <div>
                        <p className="text-subtle">{selectedEvent.description}</p>
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-small">
                        <Icon
                          icon="solar:clock-circle-linear"
                          width={16}
                          className="text-hint"
                        />
                        <div>
                          <div className="font-medium">{formatEventDate(selectedEvent)}</div>
                          <div className="text-subtle">{formatEventTime(selectedEvent)}</div>
                        </div>
                      </div>

                      {selectedEvent.location && (
                        <div className="flex items-center gap-3 text-small">
                          <Icon
                            icon="solar:map-point-linear"
                            width={16}
                            className="text-hint"
                          />
                          <span>{selectedEvent.location}</span>
                        </div>
                      )}

                      {selectedEvent.isRecurring && (
                        <div className="flex items-center gap-3 text-small">
                          <Icon
                            icon="solar:refresh-linear"
                            width={16}
                            className="text-hint"
                          />
                          <span>
                            {t('repeats')} {selectedEvent.recurringPattern?.type}
                            {selectedEvent.recurringPattern?.interval &&
                            selectedEvent.recurringPattern.interval > 1
                              ? ` (${t('every')} ${selectedEvent.recurringPattern.interval} ${selectedEvent.recurringPattern.type}s)`
                              : ''}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-small text-subtle">
                        <Icon icon="solar:users-group-rounded-linear" width={16} />
                        <span>
                          {t('createdBy')} {selectedEvent.createdBy}
                        </span>
                      </div>
                    </div>
                  </div>
                </Modal.Body>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal state={deleteModalState}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="text-center items-center">
              <Modal.Heading>{t('deleteEvent')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p>{t('deleteConfirm')}</p>
              {selectedEvent && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                  <p className="type-body font-medium text-danger">{selectedEvent.title}</p>
                  <p className="type-caption text-danger/60 mt-0.5">{formatEventDate(selectedEvent)}</p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button variant="danger" onPress={handleDeleteEvent} isPending={isDeleting}>
                {t('deleteEvent')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
