'use client';

import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { addDays, dayKey, isSameDay } from '@/lib/calendar';
import type { EventOccurrence } from '@/lib/event-occurrences';
import { EventList } from './EventList';

const useRelativeDay = () => {
  const t = useTranslations('guildCalendar');
  return (day: Date) => {
    const today = new Date();
    if (isSameDay(day, today)) return t('today');
    if (isSameDay(day, addDays(today, 1))) return t('tomorrow');
    return null;
  };
};

interface SelectedDayCardProps {
  day: Date;
  occurrences: EventOccurrence[];
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
  onCreate: () => void;
}

export function SelectedDayCard({ day, occurrences, format, onEventClick, onCreate }: SelectedDayCardProps) {
  const t = useTranslations('guildCalendar');
  const relativeDay = useRelativeDay()(day);
  const headingId = `calendar-day-${dayKey(day)}`;

  return (
    <Card aria-labelledby={headingId} className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-4 pb-0 pt-3">
        <h3 id={headingId} className="min-w-0 type-subheading text-foreground">
          {format.dayHeading(day)}
        </h3>
        <span className="shrink-0 type-caption text-hint">
          {[relativeDay, t('eventCount', { count: occurrences.length })].filter(Boolean).join(' · ')}
        </span>
      </Card.Header>
      <Card.Content className="p-1.5">
        {occurrences.length > 0 ? (
          <EventList occurrences={occurrences} day={day} format={format} onEventClick={onEventClick} />
        ) : (
          <div className="flex flex-col items-center gap-3 px-3 py-5 text-center">
            <p className="type-body text-subtle">{t('noEventsDay')}</p>
            <Button size="sm" variant="secondary" onPress={onCreate}>
              <Icon icon="solar:add-circle-linear" width={16} aria-hidden />
              {t('createEvent')}
            </Button>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

interface UpcomingListProps {
  days: Date[];
  occurrencesByDay: Map<string, EventOccurrence[]>;
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
  maxDays?: number;
}

export function UpcomingList({ days, occurrencesByDay, format, onEventClick, maxDays }: UpcomingListProps) {
  const t = useTranslations('guildCalendar');
  const relativeDay = useRelativeDay();
  const groups = days
    .map(day => ({ day, occurrences: occurrencesByDay.get(dayKey(day)) ?? [] }))
    .filter(({ occurrences }) => occurrences.length > 0)
    .slice(0, maxDays);

  return (
    <section aria-labelledby="calendar-upcoming" className="flex flex-col gap-1">
      <h3 id="calendar-upcoming" className="px-1 type-label text-soft">
        {t('upcoming')}
      </h3>
      {groups.length === 0 ? (
        <p className="px-1 py-2 type-body text-subtle">{t('noUpcoming', { days: days.length })}</p>
      ) : (
        groups.map(({ day, occurrences }) => (
          <div key={dayKey(day)} className="flex flex-col">
            <h4 className="sticky top-0 z-10 bg-background px-1 py-2 type-label text-hint">
              {[format.dayHeading(day), relativeDay(day)].filter(Boolean).join(' · ')}
            </h4>
            <Card className="border border-transparent shadow-edge bg-surface">
              <Card.Content className="p-1.5">
                <EventList occurrences={occurrences} day={day} format={format} onEventClick={onEventClick} />
              </Card.Content>
            </Card>
          </div>
        ))
      )}
    </section>
  );
}
