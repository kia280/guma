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

export interface RecurringPattern {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N days/weeks/months
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
  view: 'month' | 'week' | 'day';
  currentDate: Date;
}

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  boss_respawn: 'danger',
  guild_war: 'warning',
  guild_meeting: 'primary',
  raid: 'secondary',
  training: 'success',
  tournament: 'warning',
  social: 'default',
  other: 'default',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  boss_respawn: 'Boss Respawn',
  guild_war: 'Guild War',
  guild_meeting: 'Guild Meeting',
  raid: 'Raid',
  training: 'Training',
  tournament: 'Tournament',
  social: 'Social Event',
  other: 'Other',
};

export const PRIORITY_COLORS: Record<EventPriority, string> = {
  low: 'default',
  medium: 'primary',
  high: 'warning',
  critical: 'danger',
};

export const PRIORITY_LABELS: Record<EventPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};