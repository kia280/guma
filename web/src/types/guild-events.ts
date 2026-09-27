export interface GuildEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
  isAllDay: boolean;
  location?: string;
  participants?: string[];
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  priority: EventPriority;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | 'boss_respawn'
  | 'guild_war'
  | 'guild_meeting'
  | 'raid'
  | 'training'
  | 'tournament'
  | 'social'
  | 'other';

export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

export const EVENT_TYPES: readonly EventType[] = [
  'boss_respawn',
  'guild_war',
  'guild_meeting',
  'raid',
  'training',
  'tournament',
  'social',
  'other',
];

export const EVENT_PRIORITIES: readonly EventPriority[] = ['low', 'medium', 'high', 'critical'];

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // every N days/weeks/months
  customInterval?: { hours: number; minutes: number; seconds: number };
  daysOfWeek?: number[]; // 0-6 (Sunday to Saturday)
  endDate?: string;
  occurrences?: number;
}

export interface CreateEventData {
  title: string;
  description?: string;
  type: EventType;
  startDate: string;
  endDate?: string;
  isAllDay: boolean;
  location?: string;
  isRecurring: boolean;
  recurringPattern?: RecurringPattern;
  priority: EventPriority;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  id: string;
}

export interface CalendarViewOptions {
  view: 'month' | 'week' | 'day' | 'agenda';
  currentDate: Date;
}

export type EventChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export const EVENT_TYPE_COLORS: Record<EventType, EventChipColor> = {
  boss_respawn: 'danger',
  guild_war: 'warning',
  guild_meeting: 'accent',
  raid: 'accent',
  training: 'success',
  tournament: 'warning',
  social: 'default',
  other: 'default',
};

export const PRIORITY_COLORS: Record<EventPriority, EventChipColor> = {
  low: 'default',
  medium: 'accent',
  high: 'warning',
  critical: 'danger',
};
