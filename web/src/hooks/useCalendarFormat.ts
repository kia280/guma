'use client';

import { useTimeZone, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useIntlLocale } from '@/i18n/useIntlFormatter';
import { endsOnDay, startsOnDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';

export function useCalendarFormat() {
  const locale = useIntlLocale();
  const t = useTranslations('guildCalendar');
  const timeZone = useTimeZone();

  return useMemo(() => {
    const make = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone });
    const timeFormat = make({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    const monthFormat = make({ year: 'numeric', month: 'long' });
    const fullDateFormat = make({ year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const dayHeadingFormat = make({ month: 'long', day: 'numeric', weekday: 'short' });
    const shortDateFormat = make({ month: 'short', day: 'numeric' });
    const monthDayFormat = make({ month: 'long', day: 'numeric' });
    const yearMonthDayFormat = make({ year: 'numeric', month: 'long', day: 'numeric' });
    const weekdayFormat = make({ weekday: 'short' });

    const time = (date: Date) => timeFormat.format(date);

    const rangeLabel = (occurrence: EventOccurrence, day: Date) => {
      const { event, start, end } = occurrence;
      if (event.isAllDay) return t('allDay');
      if (!event.endDate) return time(start);
      const starts = startsOnDay(occurrence, day);
      const ends = endsOnDay(occurrence, day);
      if (starts && ends) return `${time(start)} – ${time(end)}`;
      if (starts) return `${time(start)} – ${shortDateFormat.format(end)} ${time(end)}`;
      if (ends) return t('until', { time: time(end) });
      return t('allDay');
    };

    const startLabel = (occurrence: EventOccurrence, day: Date) => {
      if (occurrence.event.isAllDay) return t('allDay');
      return startsOnDay(occurrence, day) ? time(occurrence.start) : t('continued');
    };

    return {
      time,
      rangeLabel,
      startLabel,
      month: (date: Date) => monthFormat.format(date),
      fullDate: (date: Date) => fullDateFormat.format(date),
      dayHeading: (date: Date) => dayHeadingFormat.format(date),
      shortDate: (date: Date) => shortDateFormat.format(date),
      weekday: (date: Date) => weekdayFormat.format(date),
      weekRange: (start: Date, end: Date) => {
        const startFormat = start.getFullYear() === end.getFullYear() ? monthDayFormat : yearMonthDayFormat;
        return `${startFormat.format(start)} – ${yearMonthDayFormat.format(end)}`;
      },
    };
  }, [locale, t, timeZone]);
}

export type CalendarFormat = ReturnType<typeof useCalendarFormat>;
