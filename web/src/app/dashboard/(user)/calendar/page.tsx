'use client';

import { Button, Chip, Spinner, Modal, Separator, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React, { useEffect, useState } from 'react';
import { EventFormModal } from '@/components/EventFormModal';
import { GuildCalendar } from '@/components/GuildCalendar';
import { useCalendarFormat } from '@/hooks/useCalendarFormat';
import { useDeviceClass } from '@/hooks/useDeviceClass';
import { useGuildEvents } from '@/hooks/useGuildEvents';
import { useToast } from '@/hooks/useToast';
import { type CalendarView, fillsViewport, isSameDay, readStoredView, storeView } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';
import {
  type CreateEventData,
  GuildEvent,
  EVENT_TYPE_COLORS,
  PRIORITY_COLORS,
  type UpdateEventData,
} from '@/types/guild-events';

export default function CalendarPage() {
  const t = useTranslations('calendarPage');
  const eventLabels = useTranslations('guildEvents');
  const nav = useTranslations('dashboardLayout');
  const calendarLabels = useTranslations('guildCalendar');
  const format = useCalendarFormat();
  const device = useDeviceClass();
  const {
    events,
    isLoading,
    error,
    refetch,
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
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);
  const notify = useToast();

  useEffect(() => {
    if (device) setViewType(readStoredView(device));
  }, [device, setViewType]);

  const handleViewChange = (view: CalendarView) => {
    setViewType(view);
    if (device) storeView(device, view);
  };

  useEffect(() => {
    if (error) notify.loadFailed(refetch, 'events');
  }, [error, refetch, notify]);

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

  const handleEventClick = (occurrence: EventOccurrence) => {
    setSelectedEvent(occurrence.event);
    setSelectedOccurrence(occurrence);
    detailModalState.open();
  };

  const handleDeleteEvent = async () => {
    if (!selectedEvent) return;
    try {
      await deleteEvent(selectedEvent.id);
      deleteModalState.close();
      detailModalState.close();
      notify.success(t('deleteSuccess'));
    } catch {
      notify.error(t('deleteFailed'));
    }
  };

  const handleFormSubmit = async (data: CreateEventData | UpdateEventData) => {
    if (selectedEvent) {
      await updateEvent({ ...data, id: selectedEvent.id });
    } else {
      await createEvent(data as CreateEventData);
    }
  };

  const describeWhen = (event: GuildEvent, occurrence: EventOccurrence | null) => {
    const start = occurrence?.start ?? new Date(event.startDate);
    const end = occurrence?.end ?? (event.endDate ? new Date(event.endDate) : start);
    const lastDay = end > start ? new Date(end.getTime() - 1) : start;
    const singleDay = !event.endDate || isSameDay(start, lastDay);

    if (event.isAllDay) {
      return {
        date: singleDay ? format.fullDate(start) : `${format.dayHeading(start)} – ${format.dayHeading(lastDay)}`,
        time: t('allDay'),
      };
    }
    if (singleDay) {
      return {
        date: format.fullDate(start),
        time: event.endDate ? `${format.time(start)} – ${format.time(end)}` : format.time(start),
      };
    }
    return {
      date: `${format.dayHeading(start)} ${format.time(start)}`,
      time: calendarLabels('until', { time: `${format.dayHeading(end)} ${format.time(end)}` }),
    };
  };

  const selectedWhen = selectedEvent ? describeWhen(selectedEvent, selectedOccurrence) : null;

  if (isLoading || !device) {
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
    <div className={`flex flex-col ${fillsViewport(calendarView.view, device) ? 'h-full' : ''}`}>
      <h1 className="sr-only">{nav('calendar')}</h1>

      <GuildCalendar
        events={events}
        currentDate={calendarView.currentDate}
        view={calendarView.view}
        device={device}
        onDateChange={setCalendarDate}
        onViewChange={handleViewChange}
        onNavigate={navigateCalendar}
        onEventClick={handleEventClick}
        onCreate={handleCreateEvent}
      />

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
            {selectedEvent && selectedWhen && (
              <>
                <Modal.Header className="flex flex-col items-start gap-2 pr-10">
                  <Modal.Heading className="break-words">{selectedEvent.title}</Modal.Heading>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip color={EVENT_TYPE_COLORS[selectedEvent.type]} size="sm" variant="tertiary">
                      {eventLabels(`types.${selectedEvent.type}`)}
                    </Chip>
                    <Chip color={PRIORITY_COLORS[selectedEvent.priority]} size="sm" variant="secondary">
                      {eventLabels(`priorities.${selectedEvent.priority}`)}
                    </Chip>
                  </div>
                </Modal.Header>

                <Modal.Body className="flex flex-col gap-4">
                  {selectedEvent.description && (
                    <p className="type-prose text-soft whitespace-pre-line break-words">{selectedEvent.description}</p>
                  )}

                  <Separator />

                  <dl className="flex flex-col gap-3 type-body">
                    <div className="flex items-start gap-3">
                      <dt className="pt-0.5">
                        <Icon icon="solar:clock-circle-linear" width={18} className="text-hint" aria-hidden />
                        <span className="sr-only">{t('when')}</span>
                      </dt>
                      <dd className="min-w-0 tabular-nums">
                        <div className="font-medium text-foreground">{selectedWhen.date}</div>
                        <div className="text-subtle">{selectedWhen.time}</div>
                      </dd>
                    </div>

                    {selectedEvent.location && (
                      <div className="flex items-start gap-3">
                        <dt className="pt-0.5">
                          <Icon icon="solar:map-point-linear" width={18} className="text-hint" aria-hidden />
                          <span className="sr-only">{t('where')}</span>
                        </dt>
                        <dd className="min-w-0 break-words text-foreground">{selectedEvent.location}</dd>
                      </div>
                    )}

                    {selectedEvent.isRecurring && (
                      <div className="flex items-start gap-3">
                        <dt className="pt-0.5">
                          <Icon icon="solar:refresh-linear" width={18} className="text-hint" aria-hidden />
                          <span className="sr-only">{t('recurrence')}</span>
                        </dt>
                        <dd className="text-foreground">
                          {t('repeatsEvery', {
                            type: selectedEvent.recurringPattern?.type ?? 'custom',
                            interval: selectedEvent.recurringPattern?.interval ?? 1,
                          })}
                        </dd>
                      </div>
                    )}

                    {selectedEvent.createdByName && (
                      <div className="flex items-start gap-3">
                        <dt className="pt-0.5">
                          <Icon icon="solar:users-group-rounded-linear" width={18} className="text-hint" aria-hidden />
                          <span className="sr-only">{t('organizer')}</span>
                        </dt>
                        <dd className="text-subtle">{t('createdBy', { name: selectedEvent.createdByName })}</dd>
                      </div>
                    )}
                  </dl>
                </Modal.Body>

                <Modal.Footer className="flex-wrap justify-between gap-2">
                  <Button variant="ghost" className="text-danger" onPress={deleteModalState.open}>
                    <Icon icon="solar:trash-bin-trash-linear" width={16} aria-hidden />
                    {t('deleteEvent')}
                  </Button>
                  <Button
                    variant="primary"
                    onPress={() => {
                      detailModalState.close();
                      handleEditEvent(selectedEvent);
                    }}
                  >
                    <Icon icon="solar:pen-linear" width={16} aria-hidden />
                    {t('editEvent')}
                  </Button>
                </Modal.Footer>
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
                  {selectedWhen && (
                    <p className="type-caption text-subtle mt-0.5 tabular-nums">
                      {selectedWhen.date} · {selectedWhen.time}
                    </p>
                  )}
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
