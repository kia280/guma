'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import type {
  CalendarViewOptions,
  CreateEventData,
  GuildEvent,
  UpdateEventData,
} from '@/types/guild-events';

/**
 * Aggregates calendar event data + local calendar view state (view type +
 * current date) for the calendar page.
 *
 * This is the single exception to the "no per-service hooks" rule because
 * the calendar view also owns non-data navigation state.
 */
export const useGuildEvents = (guildIdOverride?: string) => {
  const defaultGuildId = useCurrentGuildId();
  const guildId = guildIdOverride ?? defaultGuildId;

  const [calendarView, setCalendarView] = useState<CalendarViewOptions>({
    view: 'month',
    currentDate: new Date(),
  });

  const [events, setEvents] = useState<GuildEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      setEvents(await apiClient.listEvents(guildId));
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createEvent = async (data: CreateEventData) => {
    setIsCreating(true);
    try {
      const ev = await apiClient.createEvent(guildId, data);
      await refetch();
      return ev;
    } finally {
      setIsCreating(false);
    }
  };

  const updateEvent = async (data: UpdateEventData) => {
    setIsUpdating(true);
    try {
      const ev = await apiClient.updateEvent(guildId, data.id, data);
      await refetch();
      return ev;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteEvent = async (id: string) => {
    setIsDeleting(true);
    try {
      await apiClient.deleteEvent(guildId, id);
      await refetch();
    } finally {
      setIsDeleting(false);
    }
  };

  const navigateCalendar = useCallback((direction: 'prev' | 'next') => {
    setCalendarView(prev => {
      const newDate = new Date(prev.currentDate);
      switch (prev.view) {
        case 'month':
          newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
          break;
        case 'week':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
          break;
        case 'day':
          newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
          break;
      }
      return { ...prev, currentDate: newDate };
    });
  }, []);

  const setCalendarDate = useCallback((date: Date) => {
    setCalendarView(prev => ({ ...prev, currentDate: date }));
  }, []);

  const setViewType = useCallback((view: CalendarViewOptions['view']) => {
    setCalendarView(prev => ({ ...prev, view }));
  }, []);

  const getEventsForDateRange = useCallback((startDate: Date, endDate: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
      return eventStart <= endDate && eventEnd >= startDate;
    });
  }, [events]);

  const getEventsForDay = useCallback((date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return getEventsForDateRange(startOfDay, endOfDay);
  }, [getEventsForDateRange]);

  return {
    events,
    isLoading,
    error,
    calendarView,

    createEvent,
    updateEvent,
    deleteEvent,
    refetch,

    navigateCalendar,
    setCalendarDate,
    setViewType,

    getEventsForDateRange,
    getEventsForDay,

    isCreating,
    isUpdating,
    isDeleting,
  };
};
