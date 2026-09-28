import { type EventOccurrence, occurrencesOnDay, startOfDay } from '@/lib/event-occurrences';
import {
  type CalendarViewOptions,
  EVENT_TYPE_COLORS,
  type EventChipColor,
  type GuildEvent,
} from '@/types/guild-events';

export type CalendarView = CalendarViewOptions['view'];
export type DeviceClass = 'phone' | 'tablet' | 'desktop';

export const VIEWS_BY_DEVICE: Record<DeviceClass, readonly CalendarView[]> = {
  phone: ['agenda', 'day'],
  tablet: ['month', 'week', 'day'],
  desktop: ['month', 'week', 'day'],
};

export const DEFAULT_VIEW: Record<DeviceClass, CalendarView> = {
  phone: 'agenda',
  tablet: 'month',
  desktop: 'month',
};

export const fillsViewport = (view: CalendarView, device: DeviceClass) =>
  view === 'week' || view === 'day' || (view === 'month' && device === 'desktop');

export const allowedView = (device: DeviceClass, view: CalendarView): CalendarView =>
  VIEWS_BY_DEVICE[device].includes(view) ? view : DEFAULT_VIEW[device];

const viewStorageKey = (device: DeviceClass) => `guma-calendar-view-${device}`;

export const readStoredView = (device: DeviceClass): CalendarView => {
  try {
    const stored = localStorage.getItem(viewStorageKey(device));
    const allowed = VIEWS_BY_DEVICE[device];
    return allowed.find(view => view === stored) ?? DEFAULT_VIEW[device];
  } catch {
    return DEFAULT_VIEW[device];
  }
};

export const storeView = (device: DeviceClass, view: CalendarView) => {
  try {
    localStorage.setItem(viewStorageKey(device), view);
  } catch {
    return;
  }
};

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

export const startOfWeek = (date: Date) => addDays(startOfDay(date), -date.getDay());

export const getWeekDays = (date: Date) => {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
};

export const getMonthGridDays = (date: Date) => {
  const first = startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const count = Math.round((addDays(lastOfMonth, 6 - lastOfMonth.getDay()).getTime() - first.getTime()) / 86_400_000) + 1;
  return Array.from({ length: count }, (_, index) => addDays(first, index));
};

export const groupByDay = (occurrences: EventOccurrence[], days: Date[]) => {
  const grouped = new Map<string, EventOccurrence[]>();
  for (const day of days) grouped.set(dayKey(day), occurrencesOnDay(occurrences, day));
  return grouped;
};

export const sortForDay = (occurrences: EventOccurrence[], day: Date) =>
  [...occurrences].sort((a, b) => {
    const aAllDay = a.event.isAllDay || a.start < startOfDay(day);
    const bAllDay = b.event.isAllDay || b.start < startOfDay(day);
    if (aAllDay !== bAllDay) return aAllDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });

export const startsOnDay = (occurrence: EventOccurrence, day: Date) => isSameDay(occurrence.start, day);

export const endsOnDay = (occurrence: EventOccurrence, day: Date) =>
  !occurrence.event.endDate ||
  occurrence.end <= occurrence.start ||
  isSameDay(new Date(occurrence.end.getTime() - 1), day);

interface EventTone {
  accent: string;
  tint: string;
}

const tone = (variable: string): EventTone => ({
  accent: `var(${variable})`,
  tint: `color-mix(in oklab, var(${variable}) 16%, transparent)`,
});

const EVENT_TONES: Record<EventChipColor, EventTone> = {
  danger: tone('--danger'),
  warning: tone('--warning'),
  accent: tone('--accent'),
  success: tone('--success'),
  default: tone('--muted'),
};

export const eventTone = (event: GuildEvent) => EVENT_TONES[EVENT_TYPE_COLORS[event.type]] ?? EVENT_TONES.default;
