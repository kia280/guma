'use client';

import { useTranslations } from 'next-intl';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { dayKey, eventTone, isSameDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';
import { WEEKDAY_KEYS } from './MonthGrid';

interface MiniMonthProps {
  days: Date[];
  currentDate: Date;
  occurrencesByDay: Map<string, EventOccurrence[]>;
  format: CalendarFormat;
  onSelectDate: (date: Date) => void;
}

const MAX_DOTS = 3;

export function MiniMonth({ days, currentDate, occurrencesByDay, format, onSelectDate }: MiniMonthProps) {
  const t = useTranslations('guildCalendar');
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-y-0.5">
      {WEEKDAY_KEYS.map(key => (
        <div key={key} aria-hidden className="pb-1 text-center type-label text-hint">
          {t(key)}
        </div>
      ))}
      {days.map(day => {
        const occurrences = occurrencesByDay.get(dayKey(day)) ?? [];
        const isSelected = isSameDay(day, currentDate);
        const isToday = isSameDay(day, today);
        const isOutside = day.getMonth() !== currentDate.getMonth();
        const tones = Array.from(new Set(occurrences.map(({ event }) => eventTone(event).accent))).slice(0, MAX_DOTS);
        const numberClass = isSelected
          ? 'bg-accent text-accent-foreground'
          : isToday
            ? 'text-accent ring-1 ring-inset ring-accent/60'
            : isOutside
              ? 'text-disabled'
              : 'text-foreground';

        return (
          <button
            key={dayKey(day)}
            type="button"
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${format.fullDate(day)}, ${t('eventCount', { count: occurrences.length })}`}
            onClick={() => onSelectDate(day)}
            className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg py-0.5 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-full type-label tabular-nums ${numberClass}`}
            >
              {day.getDate()}
            </span>
            <span aria-hidden className="flex h-1.5 items-center gap-0.5">
              {tones.map(color => (
                <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
