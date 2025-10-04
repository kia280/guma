'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GuildEvent, CreateEventData, UpdateEventData, CalendarViewOptions } from '@/types/guild-events';

// Mock API functions - replace with actual API calls
const mockApi = {
  getEvents: async (guildId: string): Promise<GuildEvent[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock data from localStorage or default data
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Default mock events
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return [
      {
        id: '1',
        title: 'Dragon Boss Respawn',
        description: 'Ancient Dragon respawns in the eastern mountains',
        type: 'boss_respawn',
        startDate: tomorrow.toISOString(),
        isAllDay: false,
        location: 'Eastern Mountains',
        isRecurring: true,
        recurringPattern: {
          type: 'daily',
          interval: 1,
        },
        priority: 'high',
        createdBy: 'admin',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: '2',
        title: 'Guild War vs Dragon Slayers',
        description: 'Prepare for battle!',
        type: 'guild_war',
        startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        isAllDay: false,
        isRecurring: false,
        priority: 'critical',
        createdBy: 'admin',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }
    ];
  },

  createEvent: async (guildId: string, eventData: CreateEventData): Promise<GuildEvent> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newEvent: GuildEvent = {
      ...eventData,
      id: Date.now().toString(),
      participants: [],
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    events.push(newEvent);
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(events));
    
    return newEvent;
  },

  updateEvent: async (guildId: string, eventData: UpdateEventData): Promise<GuildEvent> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    const eventIndex = events.findIndex(e => e.id === eventData.id);
    
    if (eventIndex === -1) {
      throw new Error('Event not found');
    }
    
    const updatedEvent = {
      ...events[eventIndex],
      ...eventData,
      updatedAt: new Date().toISOString(),
    };
    
    events[eventIndex] = updatedEvent;
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(events));
    
    return updatedEvent;
  },

  deleteEvent: async (guildId: string, eventId: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    const filteredEvents = events.filter(e => e.id !== eventId);
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(filteredEvents));
  },
};

export const useGuildEvents = (guildId: string = 'default') => {
  const [calendarView, setCalendarView] = useState<CalendarViewOptions>({
    view: 'month',
    currentDate: new Date(),
  });

  const queryClient = useQueryClient();

  // Query for fetching events
  const {
    data: events = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['guild-events', guildId],
    queryFn: () => mockApi.getEvents(guildId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Mutation for creating events
  const createEventMutation = useMutation({
    mutationFn: (eventData: CreateEventData) => mockApi.createEvent(guildId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-events', guildId] });
    },
  });

  // Mutation for updating events
  const updateEventMutation = useMutation({
    mutationFn: (eventData: UpdateEventData) => mockApi.updateEvent(guildId, eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-events', guildId] });
    },
  });

  // Mutation for deleting events
  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => mockApi.deleteEvent(guildId, eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guild-events', guildId] });
    },
  });

  // Calendar navigation functions
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
      
      return {
        ...prev,
        currentDate: newDate,
      };
    });
  }, []);

  const setCalendarDate = useCallback((date: Date) => {
    setCalendarView(prev => ({
      ...prev,
      currentDate: date,
    }));
  }, []);

  const setViewType = useCallback((view: CalendarViewOptions['view']) => {
    setCalendarView(prev => ({
      ...prev,
      view,
    }));
  }, []);

  // Filter events by date range
  const getEventsForDateRange = useCallback((startDate: Date, endDate: Date) => {
    return events.filter(event => {
      const eventStart = new Date(event.startDate);
      const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
      
      return (eventStart <= endDate && eventEnd >= startDate);
    });
  }, [events]);

  // Get events for a specific day
  const getEventsForDay = useCallback((date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return getEventsForDateRange(startOfDay, endOfDay);
  }, [getEventsForDateRange]);

  return {
    // Data
    events,
    isLoading,
    error,
    calendarView,
    
    // Actions
    createEvent: createEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    refetch,
    
    // Calendar controls
    navigateCalendar,
    setCalendarDate,
    setViewType,
    
    // Utilities
    getEventsForDateRange,
    getEventsForDay,
    
    // Loading states
    isCreating: createEventMutation.isPending,
    isUpdating: updateEventMutation.isPending,
    isDeleting: deleteEventMutation.isPending,
  };
};