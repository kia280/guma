'use client';

import { useTranslations } from 'next-intl';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { dayKey, eventTone, isSameDay, sortForDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';
import { WEEKDAY_KEYS } from './MonthGrid';

interface MiniMonthProps {
  days: Date[];
  currentDate: Date;
  occurrencesByDay: Map<string, EventOccurrence[]>;
  format: CalendarFormat;
  onSelectDate: (date: Date) => void;
}

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
        const occurrences = sortForDay(occurrencesByDay.get(dayKey(day)) ?? [], day);
        const first = occurrences[0];
        const isSelected = isSameDay(day, currentDate);
        const isToday = isSameDay(day, today);
        const isOutside = day.getMonth() !== currentDate.getMonth();
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
            className="flex min-h-11 min-w-0 flex-col items-stretch justify-start gap-0.5 rounded-lg px-0.5 py-0.5 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span
              className={`flex size-7 items-center justify-center self-center rounded-full type-label tabular-nums ${numberClass}`}
            >
              {day.getDate()}
            </span>
            {first && (
              <span aria-hidden className="flex min-w-0 flex-col">
                <span
                  className="overflow-hidden whitespace-nowrap text-clip rounded-sm px-1 text-left type-caption text-foreground"
                  style={{ backgroundColor: eventTone(first.event).tint, boxShadow: `inset 2px 0 0 ${eventTone(first.event).accent}` }}
                >
                  {first.event.title}
                </span>
                {occurrences.length > 1 && (
                  <span className="px-1 text-left type-caption tabular-nums text-soft">+{occurrences.length - 1}</span>
                )}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
