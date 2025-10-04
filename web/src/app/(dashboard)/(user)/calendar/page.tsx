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
  useDisclosure,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
} from '@heroui/react';
import { 
  PlusIcon, 
  EllipsisHorizontalIcon, 
  PencilIcon, 
  TrashIcon,
  ClockIcon,
  MapPinIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { useGuildEvents } from '@/hooks/useGuildEvents';
import { GuildCalendar } from '@/components/GuildCalendar';
import { EventFormModal } from '@/components/EventFormModal';
import { 
  GuildEvent, 
  EVENT_TYPE_COLORS, 
  EVENT_TYPE_LABELS, 
  PRIORITY_COLORS, 
  PRIORITY_LABELS 
} from '@/types/guild-events';

export default function CalendarPage() {
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
    if (event.isAllDay) return 'All Day';
    
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;
    
    if (end && !event.isAllDay) {
      return `${start.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })} - ${end.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    return start.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatEventDate = (event: GuildEvent) => {
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : null;
    
    if (end && start.toDateString() !== end.toDateString()) {
      return `${start.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })} - ${end.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })}`;
    }
    
    return start.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-default-500">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Guild Calendar</h1>
          <p className="text-default-500 mt-1">
            Manage guild events, boss respawns, and meetings
          </p>
        </div>
        
        <Button
          color="primary"
          startContent={<PlusIcon className="w-4 h-4" />}
          onPress={handleCreateEvent}
        >
          Create Event
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
        <Modal
          isOpen={isDetailOpen}
          onClose={onDetailClose}
          size="lg"
        >
          <ModalContent>
            <ModalHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Chip
                  color={EVENT_TYPE_COLORS[selectedEvent.type] as any}
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
              
              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly variant="light" size="sm">
                    <EllipsisHorizontalIcon className="w-4 h-4" />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu>
                  <DropdownItem
                    key="edit"
                    startContent={<PencilIcon className="w-4 h-4" />}
                    onPress={() => {
                      onDetailClose();
                      handleEditEvent(selectedEvent);
                    }}
                  >
                    Edit Event
                  </DropdownItem>
                  <DropdownItem
                    key="delete"
                    color="danger"
                    startContent={<TrashIcon className="w-4 h-4" />}
                    onPress={onDeleteOpen}
                  >
                    Delete Event
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </ModalHeader>

            <ModalBody className="pb-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {selectedEvent.title}
                  </h3>
                  {selectedEvent.description && (
                    <p className="text-default-600">
                      {selectedEvent.description}
                    </p>
                  )}
                </div>

                <Divider />

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-small">
                    <ClockIcon className="w-4 h-4 text-default-400" />
                    <div>
                      <div className="font-medium">{formatEventDate(selectedEvent)}</div>
                      <div className="text-default-500">{formatEventTime(selectedEvent)}</div>
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-center gap-3 text-small">
                      <MapPinIcon className="w-4 h-4 text-default-400" />
                      <span>{selectedEvent.location}</span>
                    </div>
                  )}

                  {selectedEvent.isRecurring && (
                    <div className="flex items-center gap-3 text-small">
                      <div className="w-4 h-4 text-default-400">🔄</div>
                      <span>
                        Repeats {selectedEvent.recurringPattern?.type} 
                        {selectedEvent.recurringPattern?.interval && selectedEvent.recurringPattern.interval > 1 
                          ? ` (every ${selectedEvent.recurringPattern.interval} ${selectedEvent.recurringPattern.type}s)`
                          : ''
                        }
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-small text-default-500">
                    <UsersIcon className="w-4 h-4" />
                    <span>Created by {selectedEvent.createdBy}</span>
                  </div>
                </div>
              </div>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose} size="sm">
        <ModalContent>
          <ModalHeader>Delete Event</ModalHeader>
          <ModalBody>
            <p>Are you sure you want to delete this event? This action cannot be undone.</p>
            {selectedEvent && (
              <div className="mt-3 p-3 bg-danger-50 dark:bg-danger/10 rounded-lg">
                <p className="font-medium text-danger">{selectedEvent.title}</p>
                <p className="text-small text-danger/70">
                  {formatEventDate(selectedEvent)}
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteEvent}
              isLoading={isDeleting}
            >
              Delete Event
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
