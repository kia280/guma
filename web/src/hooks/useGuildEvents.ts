'use client';

import { useCallback, useEffect, useState } from 'react';
import { useCurrentGuildId } from '@/lib/current-guild';
import { expandEventOccurrences } from '@/lib/event-occurrences';
import { apiClient } from '@/lib/guma';
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
  const [loadedGuildId, setLoadedGuildId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const refetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setEvents(await apiClient.listEvents(guildId));
    } catch (err) {
      setError(err);
    } finally {
      setIsRefreshing(false);
    }
  }, [guildId]);

  const isLoading = loadedGuildId !== guildId;

  useEffect(() => {
    let ignore = false;
    apiClient
      .listEvents(guildId)
      .then(
        data => {
          if (!ignore) setEvents(data);
        },
        err => {
          if (!ignore) setError(err);
        },
      )
      .finally(() => {
        if (!ignore) setLoadedGuildId(guildId);
      });
    return () => {
      ignore = true;
    };
  }, [guildId]);

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
        case 'agenda': {
          const targetMonth = newDate.getMonth() + (direction === 'next' ? 1 : -1);
          const lastDay = new Date(newDate.getFullYear(), targetMonth + 1, 0).getDate();
          newDate.setDate(Math.min(newDate.getDate(), lastDay));
          newDate.setMonth(targetMonth);
          break;
        }
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
    const matched = new Map<string, GuildEvent>();
    for (const occurrence of expandEventOccurrences(events, startDate, endDate)) {
      if (!matched.has(occurrence.event.id)) matched.set(occurrence.event.id, occurrence.event);
    }
    return Array.from(matched.values());
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
    isRefreshing,
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
