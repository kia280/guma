import type { GuildEvent, RecurringPattern } from '@/types/guild-events';

export interface EventOccurrence {
  key: string;
  event: GuildEvent;
  start: Date;
  end: Date;
}

interface SeriesStart {
  index: number;
  start: Date;
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_OCCURRENCES_PER_EVENT = 1000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

export const endOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result.getDate() === date.getDate() ? result : null;
};

const lastInstant = (start: Date, end: Date) =>
  end > start ? end.getTime() - 1 : end.getTime();

const overlapsRange = (start: Date, end: Date, rangeStart: Date, rangeEnd: Date) =>
  start.getTime() <= rangeEnd.getTime() && lastInstant(start, end) >= rangeStart.getTime();

const normalizeStep = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;

const customStepMs = (pattern: RecurringPattern) => {
  const custom = pattern.customInterval;
  if (!custom) return 0;
  const seconds = (custom.hours || 0) * 3600 + (custom.minutes || 0) * 60 + (custom.seconds || 0);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
};

const parseUntil = (value: string | undefined) => {
  if (!value) return null;
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  const until = new Date(value);
  return Number.isNaN(until.getTime()) ? null : until;
};

const validDaysOfWeek = (pattern: RecurringPattern) => {
  const days = (pattern.daysOfWeek ?? []).filter(
    day => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  return Array.from(new Set(days)).sort((a, b) => a - b);
};

const firstIndexNear = (base: Date, notBefore: Date, stepMs: number) =>
  Math.max(0, Math.floor((notBefore.getTime() - base.getTime()) / stepMs) - 1);

function* fixedSteps(
  base: Date,
  approxStepMs: number,
  notBefore: Date,
  startAt: (index: number) => Date,
): Generator<SeriesStart> {
  for (let index = firstIndexNear(base, notBefore, approxStepMs); ; index++) {
    yield { index, start: startAt(index) };
  }
}

function* weeklyOnDays(
  base: Date,
  stepWeeks: number,
  days: number[],
  notBefore: Date,
): Generator<SeriesStart> {
  const weekStart = addDays(base, -base.getDay());
  const skippedInFirstWeek = days.filter(day => day < base.getDay()).length;
  let week = firstIndexNear(weekStart, notBefore, stepWeeks * WEEK_MS);
  let index = week === 0 ? 0 : week * days.length - skippedInFirstWeek;
  for (; ; week++) {
    for (const day of days) {
      const start = addDays(weekStart, week * 7 * stepWeeks + day);
      if (start < base) continue;
      yield { index: index++, start };
    }
  }
}

function* monthlySteps(base: Date, stepMonths: number, rangeEnd: Date): Generator<SeriesStart> {
  let index = 0;
  for (let months = 0; ; months += stepMonths) {
    const anchor = new Date(base.getFullYear(), base.getMonth() + months, 1);
    if (anchor > rangeEnd) return;
    const start = addMonths(base, months);
    if (start) yield { index: index++, start };
  }
}

function* singleStart(base: Date): Generator<SeriesStart> {
  yield { index: 0, start: base };
}

const seriesStarts = (
  base: Date,
  pattern: RecurringPattern,
  notBefore: Date,
  rangeEnd: Date,
): Generator<SeriesStart> => {
  switch (pattern.type) {
    case 'daily': {
      const step = normalizeStep(pattern.interval);
      return fixedSteps(base, step * DAY_MS, notBefore, index => addDays(base, index * step));
    }
    case 'weekly': {
      const step = normalizeStep(pattern.interval);
      const days = validDaysOfWeek(pattern);
      if (days.length > 0) return weeklyOnDays(base, step, days, notBefore);
      return fixedSteps(base, step * WEEK_MS, notBefore, index => addDays(base, index * 7 * step));
    }
    case 'monthly':
      return monthlySteps(base, normalizeStep(pattern.interval), rangeEnd);
    case 'custom': {
      const stepMs = customStepMs(pattern);
      if (stepMs <= 0) return singleStart(base);
      return fixedSteps(base, stepMs, notBefore, index => new Date(base.getTime() + index * stepMs));
    }
    default:
      return singleStart(base);
  }
};

const eventDuration = (event: GuildEvent, base: Date) => {
  if (!event.endDate) return 0;
  const end = new Date(event.endDate);
  if (Number.isNaN(end.getTime())) return 0;
  return Math.max(0, end.getTime() - base.getTime());
};

const toOccurrence = (event: GuildEvent, start: Date, durationMs: number): EventOccurrence => ({
  key: `${event.id}:${start.getTime()}`,
  event,
  start,
  end: new Date(start.getTime() + durationMs),
});

const expandEvent = (event: GuildEvent, rangeStart: Date, rangeEnd: Date): EventOccurrence[] => {
  const base = new Date(event.startDate);
  if (Number.isNaN(base.getTime())) return [];
  const durationMs = eventDuration(event, base);
  const pattern = event.isRecurring ? event.recurringPattern : undefined;

  if (!pattern) {
    const single = toOccurrence(event, base, durationMs);
    return overlapsRange(single.start, single.end, rangeStart, rangeEnd) ? [single] : [];
  }

  const until = parseUntil(pattern.endDate);
  const maxCount =
    typeof pattern.occurrences === 'number' && pattern.occurrences > 0 ? pattern.occurrences : 0;
  const notBefore = new Date(rangeStart.getTime() - durationMs);
  const result: EventOccurrence[] = [];

  for (const { index, start } of seriesStarts(base, pattern, notBefore, rangeEnd)) {
    if (maxCount > 0 && index >= maxCount) break;
    if (until && start > until) break;
    if (start > rangeEnd) break;
    const occurrence = toOccurrence(event, start, durationMs);
    if (overlapsRange(occurrence.start, occurrence.end, rangeStart, rangeEnd)) {
      result.push(occurrence);
      if (result.length >= MAX_OCCURRENCES_PER_EVENT) break;
    }
  }

  return result;
};

export const expandEventOccurrences = (
  events: GuildEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventOccurrence[] =>
  events
    .flatMap(event => expandEvent(event, rangeStart, rangeEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

export const occurrencesOnDay = (occurrences: EventOccurrence[], day: Date) => {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return occurrences.filter(occurrence =>
    overlapsRange(occurrence.start, occurrence.end, dayStart, dayEnd),
  );
};
