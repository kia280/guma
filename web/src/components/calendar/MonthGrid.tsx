'use client';

import { useTranslations } from 'next-intl';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { dayKey, eventTone, isSameDay, sortForDay, startsOnDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const MAX_CHIPS = 3;

interface MonthGridProps {
  days: Date[];
  currentDate: Date;
  occurrencesByDay: Map<string, EventOccurrence[]>;
  format: CalendarFormat;
  showTimes: boolean;
  onSelectDate: (date: Date) => void;
  onShowDay: (date: Date) => void;
  onEventClick: (occurrence: EventOccurrence) => void;
}

export function MonthGrid({
  days,
  currentDate,
  occurrencesByDay,
  format,
  showTimes,
  onSelectDate,
  onShowDay,
  onEventClick,
}: MonthGridProps) {
  const t = useTranslations('guildCalendar');
  const today = new Date();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-divider bg-surface">
      <div aria-hidden className="grid grid-cols-7 border-b border-divider">
        {WEEKDAY_KEYS.map(key => (
          <div key={key} className="py-2 text-center type-label text-hint">
            {t(key)}
          </div>
        ))}
      </div>

      <div
        className="grid flex-1 grid-cols-7"
        style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(6.75rem, 1fr))` }}
      >
        {days.map((day, index) => {
          const occurrences = sortForDay(occurrencesByDay.get(dayKey(day)) ?? [], day);
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, currentDate);
          const isOutside = day.getMonth() !== currentDate.getMonth();
          const visible = occurrences.length > MAX_CHIPS ? occurrences.slice(0, MAX_CHIPS - 1) : occurrences;
          const hiddenCount = occurrences.length - visible.length;
          const background = isSelected ? 'bg-accent/10' : isOutside ? 'bg-surface-secondary/60' : '';
          const numberClass = isToday
            ? 'bg-accent text-accent-foreground'
            : isOutside
              ? 'text-disabled'
              : 'text-foreground';

          return (
            <div
              key={dayKey(day)}
              data-cell
              className={`relative flex min-w-0 flex-col gap-0.5 border-divider p-1 ${index % 7 ? 'border-l' : ''} ${index >= 7 ? 'border-t' : ''} ${background}`}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${format.fullDate(day)}, ${t('eventCount', { count: occurrences.length })}`}
                onClick={() => onSelectDate(day)}
                className="absolute inset-0 cursor-pointer transition-colors hover:bg-surface-secondary/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
              />
              <span
                aria-hidden
                className={`pointer-events-none relative flex size-7 items-center justify-center rounded-full type-label tabular-nums ${numberClass}`}
              >
                {day.getDate()}
              </span>

              {visible.map(occurrence => (
                <MonthChip
                  key={occurrence.key}
                  occurrence={occurrence}
                  day={day}
                  format={format}
                  showTime={showTimes}
                  onEventClick={onEventClick}
                />
              ))}

              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => onShowDay(day)}
                  aria-label={t('showMore', { count: hiddenCount, date: format.fullDate(day) })}
                  className="relative self-start rounded-md px-1.5 type-label tabular-nums text-soft transition-colors hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                >
                  {t('more', { count: hiddenCount })}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MonthChipProps {
  occurrence: EventOccurrence;
  day: Date;
  format: CalendarFormat;
  showTime: boolean;
  onEventClick: (occurrence: EventOccurrence) => void;
}

function MonthChip({ occurrence, day, format, showTime, onEventClick }: MonthChipProps) {
  const { event } = occurrence;
  const tone = eventTone(event);
  const isBar = event.isAllDay || !startsOnDay(occurrence, day);

  return (
    <button
      type="button"
      onClick={() => onEventClick(occurrence)}
      aria-label={`${event.title}, ${format.rangeLabel(occurrence, day)}`}
      className="relative flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 text-left type-caption transition-colors hover:bg-surface-tertiary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
      style={isBar ? { backgroundColor: tone.tint, boxShadow: `inset 3px 0 0 ${tone.accent}` } : undefined}
    >
      {!isBar && (
        <>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone.accent }} />
          {showTime && <span className="shrink-0 tabular-nums text-subtle">{format.time(occurrence.start)}</span>}
        </>
      )}
      <span className="min-w-0 truncate text-foreground">{event.title}</span>
    </button>
  );
}
