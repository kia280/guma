'use client';

import { Popover } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { type CSSProperties, useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import type { EventOccurrence } from '@/lib/event-occurrences';
import { EventList } from './EventList';

interface MoreEventsPopoverProps {
  occurrences: EventOccurrence[];
  day: Date;
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
  className?: string;
  style?: CSSProperties;
}

export function MoreEventsPopover({ occurrences, day, format, onEventClick, className, style }: MoreEventsPopoverProps) {
  const t = useTranslations('guildCalendar');
  const [isOpen, setIsOpen] = useState(false);
  const count = occurrences.length;

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <AriaButton
        aria-label={t('showMore', { count, date: format.fullDate(day) })}
        className={`cursor-pointer rounded-md type-label tabular-nums text-soft transition-colors hover:bg-surface-tertiary data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus ${className ?? ''}`}
        style={style}
      >
        +{count}
      </AriaButton>
      <Popover.Content className="w-80 max-w-[calc(100vw-2rem)]">
        <Popover.Dialog className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-1.5">
          <Popover.Heading className="px-3 pt-1.5 type-label text-soft">
            {format.dayHeading(day)} · {t('moreEventsTitle', { count })}
          </Popover.Heading>
          <EventList
            occurrences={occurrences}
            day={day}
            format={format}
            onEventClick={occurrence => {
              setIsOpen(false);
              onEventClick(occurrence);
            }}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
