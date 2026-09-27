'use client';

import { useTranslations } from 'next-intl';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { eventTone, sortForDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';

interface EventListProps {
  occurrences: EventOccurrence[];
  day: Date;
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
}

export function EventList({ occurrences, day, format, onEventClick }: EventListProps) {
  const eventLabels = useTranslations('guildEvents');

  return (
    <ul className="flex flex-col gap-0.5">
      {sortForDay(occurrences, day).map(occurrence => {
        const { event } = occurrence;
        const range = format.rangeLabel(occurrence, day);
        const meta = [range, eventLabels(`types.${event.type}`), event.location].filter(Boolean).join(' · ');
        return (
          <li key={occurrence.key}>
            <button
              type="button"
              onClick={() => onEventClick(occurrence)}
              className="flex min-h-11 w-full items-stretch gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="w-13 shrink-0 type-body tabular-nums text-soft">
                {format.startLabel(occurrence, day)}
              </span>
              <span
                aria-hidden
                className="w-1 shrink-0 rounded-full"
                style={{ backgroundColor: eventTone(event).accent }}
              />
              <span className="min-w-0 flex-1">
                <span className="block break-words type-body font-medium text-foreground line-clamp-2">
                  {event.title}
                </span>
                <span className="block truncate type-caption text-hint tabular-nums">{meta}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
