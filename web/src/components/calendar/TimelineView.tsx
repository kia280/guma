'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CalendarFormat } from '@/hooks/useCalendarFormat';
import { dayKey, endsOnDay, eventTone, isSameDay, startsOnDay } from '@/lib/calendar';
import { type EventOccurrence, startOfDay } from '@/lib/event-occurrences';
import { MoreEventsPopover } from './MoreEventsPopover';

const HOUR_PX = 60;
const DAY_PX = 24 * HOUR_PX;
const MIN_EVENT_PX = 30;
const INSET_PX = 3;
const GAP_PX = 2;
const MIN_EVENT_WIDTH_REM = 4.5;
const MORE_WIDTH_REM = 2.25;
const MAX_ALL_DAY_CHIPS = 2;
const DEFAULT_SCROLL_MINUTES = 8 * 60;

interface TimelineViewProps {
  days: Date[];
  occurrencesByDay: Map<string, EventOccurrence[]>;
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
  onOpenDay: (date: Date) => void;
}

interface Segment {
  occurrence: EventOccurrence;
  top: number;
  height: number;
  column: number;
}

interface Cluster {
  segments: Segment[];
  columns: number;
  top: number;
  bottom: number;
}

const minutesIntoDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const toPx = (minutes: number) => (minutes * HOUR_PX) / 60;

const isTimed = (occurrence: EventOccurrence) => !occurrence.event.isAllDay;

const segmentFor = (occurrence: EventOccurrence, day: Date) => {
  const top = startsOnDay(occurrence, day) ? toPx(minutesIntoDay(occurrence.start)) : 0;
  let bottom = top + HOUR_PX;
  if (occurrence.event.endDate) {
    bottom = endsOnDay(occurrence, day) && isSameDay(occurrence.end, day) ? toPx(minutesIntoDay(occurrence.end)) : DAY_PX;
  }
  const height = Math.min(Math.max(bottom - top, MIN_EVENT_PX), DAY_PX - top);
  return { top, height };
};

const clusterSegments = (occurrences: EventOccurrence[], day: Date): Cluster[] => {
  const sorted = occurrences
    .map(occurrence => ({ occurrence, ...segmentFor(occurrence, day), column: 0 }))
    .sort((a, b) => a.top - b.top || b.height - a.height);

  const clusters: Cluster[] = [];
  let current: Cluster | null = null;
  let columnEnds: number[] = [];

  for (const segment of sorted) {
    if (!current || segment.top >= current.bottom) {
      current = { segments: [], columns: 0, top: segment.top, bottom: 0 };
      clusters.push(current);
      columnEnds = [];
    }
    let column = columnEnds.findIndex(end => end <= segment.top);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(segment.top + segment.height);
    } else {
      columnEnds[column] = segment.top + segment.height;
    }
    segment.column = column;
    current.segments.push(segment);
    current.columns = columnEnds.length;
    current.bottom = Math.max(current.bottom, segment.top + segment.height);
  }

  return clusters;
};

export function TimelineView({ days, occurrencesByDay, format, onEventClick, onOpenDay }: TimelineViewProps) {
  const t = useTranslations('guildCalendar');
  const scrollRef = useRef<HTMLDivElement>(null);
  const columnRef = useRef<HTMLDivElement>(null);
  const lastScrolledRange = useRef<string | null>(null);
  const [metrics, setMetrics] = useState({ columnWidth: 0, remPx: 16 });
  const [now, setNow] = useState(() => new Date());
  const isWeek = days.length > 1;
  const rangeKey = `${dayKey(days[0])}:${days.length}`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const column = columnRef.current;
    if (!column) return;
    const observer = new ResizeObserver(([entry]) =>
      setMetrics({
        columnWidth: entry.contentRect.width,
        remPx: parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
      }),
    );
    observer.observe(column);
    return () => observer.disconnect();
  }, [rangeKey]);

  const byDay = useMemo(
    () =>
      days.map(day => {
        const occurrences = occurrencesByDay.get(dayKey(day)) ?? [];
        return {
          day,
          allDay: occurrences.filter(occurrence => !isTimed(occurrence)),
          clusters: clusterSegments(occurrences.filter(isTimed), day),
        };
      }),
    [days, occurrencesByDay],
  );

  const hasAllDay = byDay.some(({ allDay }) => allDay.length > 0);
  const includesToday = days.some(day => isSameDay(day, now));

  const initialScrollMinutes = useMemo(() => {
    if (includesToday) return minutesIntoDay(new Date()) - 90;
    const tops = byDay.flatMap(({ clusters }) => clusters.map(cluster => cluster.top));
    return tops.length > 0 ? (Math.min(...tops) * 60) / HOUR_PX - 30 : DEFAULT_SCROLL_MINUTES;
  }, [byDay, includesToday]);

  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || lastScrolledRange.current === rangeKey) return;
    lastScrolledRange.current = rangeKey;
    scroller.scrollTop = Math.max(0, toPx(initialScrollMinutes));
  }, [rangeKey, initialScrollMinutes]);

  const hours = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 24 }, (_, hour) => {
      const date = new Date(base);
      date.setHours(hour);
      return format.time(date);
    });
  }, [format]);

  const gutter = 'w-14 shrink-0';

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-xl border border-transparent shadow-edge bg-surface">
      {isWeek && (
        <div className="flex overflow-y-hidden border-b border-divider [scrollbar-gutter:stable]">
          <div className={gutter} />
          {days.map(day => {
            const isToday = isSameDay(day, now);
            return (
              <button
                key={dayKey(day)}
                type="button"
                aria-label={t('openDay', { date: format.fullDate(day) })}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => onOpenDay(day)}
                className={`flex min-w-0 flex-1 flex-col items-center border-l border-divider px-1 py-2 transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${isToday ? 'bg-accent/5' : ''}`}
              >
                <span className="type-label text-hint">{format.weekday(day)}</span>
                <span
                  className={`mt-0.5 flex size-8 items-center justify-center rounded-full type-subheading tabular-nums ${isToday ? 'bg-accent text-accent-foreground' : 'text-foreground'}`}
                >
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hasAllDay && (
        <div className="flex overflow-y-hidden border-b border-divider [scrollbar-gutter:stable]">
          <div className={`${gutter} flex items-start justify-end pr-2 pt-1.5 type-caption text-hint`}>
            {t('allDay')}
          </div>
          {byDay.map(({ day, allDay }) => {
            const visible = allDay.length > MAX_ALL_DAY_CHIPS ? allDay.slice(0, MAX_ALL_DAY_CHIPS - 1) : allDay;
            const hidden = allDay.slice(visible.length);
            return (
              <div key={dayKey(day)} data-cell className="flex min-w-0 flex-1 flex-col gap-0.5 border-l border-divider p-1">
                {visible.map(occurrence => {
                  const tone = eventTone(occurrence.event);
                  return (
                    <button
                      key={occurrence.key}
                      type="button"
                      onClick={() => onEventClick(occurrence)}
                      aria-label={`${occurrence.event.title}, ${format.rangeLabel(occurrence, day)}`}
                      className="min-h-6 w-full min-w-0 truncate rounded-md px-1.5 text-left type-caption text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                      style={{ backgroundColor: tone.tint, boxShadow: `inset 3px 0 0 ${tone.accent}` }}
                    >
                      {occurrence.event.title}
                    </button>
                  );
                })}
                {hidden.length > 0 && (
                  <MoreEventsPopover
                    occurrences={hidden}
                    day={day}
                    format={format}
                    onEventClick={onEventClick}
                    className="self-start px-1.5"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        <div className={`${gutter} relative`} style={{ height: DAY_PX }}>
          {hours.map((label, hour) => (
            <div
              key={label}
              style={{ top: hour * HOUR_PX }}
              className="absolute flex w-full justify-end pr-2 pt-1 type-caption tabular-nums text-hint select-none"
            >
              {label}
            </div>
          ))}
        </div>

        {byDay.map(({ day, clusters }, index) => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={dayKey(day)}
              ref={index === 0 ? columnRef : undefined}
              className={`relative min-w-0 flex-1 border-l border-divider ${isToday && isWeek ? 'bg-accent/5' : ''}`}
              style={{ height: DAY_PX }}
            >
              {hours.map((label, hour) => (
                <div
                  key={label}
                  aria-hidden
                  style={{ top: hour * HOUR_PX, height: HOUR_PX }}
                  className="absolute w-full border-b border-divider/40"
                />
              ))}

              {clusters.map(cluster => (
                <TimelineCluster
                  key={cluster.segments[0].occurrence.key}
                  cluster={cluster}
                  day={day}
                  metrics={metrics}
                  format={format}
                  onEventClick={onEventClick}
                />
              ))}

              {isToday && (
                <div
                  aria-hidden
                  style={{ top: toPx(minutesIntoDay(now)) }}
                  className="pointer-events-none absolute z-30 w-full"
                >
                  <div className="absolute -left-1 -top-1 size-2 rounded-full bg-danger" />
                  <div className="border-t-2 border-danger" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TimelineClusterProps {
  cluster: Cluster;
  day: Date;
  metrics: { columnWidth: number; remPx: number };
  format: CalendarFormat;
  onEventClick: (occurrence: EventOccurrence) => void;
}

function TimelineCluster({ cluster, day, metrics, format, onEventClick }: TimelineClusterProps) {
  const { columnWidth, remPx } = metrics;
  const minWidth = MIN_EVENT_WIDTH_REM * remPx;
  const moreWidth = MORE_WIDTH_REM * remPx;
  const usable = columnWidth - 2 * INSET_PX;
  const fits = columnWidth === 0 || cluster.columns * minWidth <= usable;
  const overlayMore = !fits && usable - moreWidth < minWidth;
  const visibleColumns = fits
    ? cluster.columns
    : overlayMore
      ? 1
      : Math.max(1, Math.floor((usable - moreWidth) / minWidth));
  const visible = cluster.segments.filter(segment => segment.column < visibleColumns);
  const hidden = cluster.segments.filter(segment => segment.column >= visibleColumns);
  const reserved = hidden.length > 0 && !overlayMore ? moreWidth : 0;
  const slot = `((100% - ${2 * INSET_PX + reserved}px) / ${visibleColumns})`;
  const slotPx = columnWidth === 0 ? Infinity : (usable - reserved) / visibleColumns;
  const canWrap = slotPx >= minWidth;

  return (
    <>
      {visible.map(({ occurrence, top, height, column }) => {
        const { event } = occurrence;
        const tone = eventTone(event);
        const range = format.rangeLabel(occurrence, day);
        const isCompact = height < 44;
        return (
          <button
            key={occurrence.key}
            type="button"
            onClick={() => onEventClick(occurrence)}
            aria-label={`${event.title}, ${range}`}
            style={{
              top,
              height,
              left: `calc(${INSET_PX}px + ${column} * ${slot})`,
              width: `calc(${slot} - ${visibleColumns > 1 || reserved ? GAP_PX : 0}px)`,
              backgroundColor: tone.tint,
              boxShadow: `inset 3px 0 0 ${tone.accent}, 0 0 0 1px var(--surface)`,
            }}
            className="absolute z-20 flex flex-col items-stretch justify-start overflow-hidden rounded-md py-0.5 pl-2.5 pr-1 text-left transition-opacity hover:opacity-85 focus-visible:z-40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
          >
            {isCompact ? (
              <span className="truncate type-label text-foreground">
                <span className="tabular-nums text-subtle">{format.startLabel(occurrence, day)} </span>
                {event.title}
              </span>
            ) : (
              <>
                <span className={`type-label text-foreground ${canWrap && height >= 64 ? 'break-words line-clamp-3' : 'truncate'}`}>
                  {event.title}
                </span>
                <span className={`type-caption tabular-nums text-subtle ${canWrap && height >= 88 ? 'break-words' : 'truncate'}`}>
                  {range}
                </span>
              </>
            )}
          </button>
        );
      })}
      {hidden.length > 0 && (
        <MoreEventsPopover
          occurrences={hidden.map(segment => segment.occurrence)}
          day={day}
          format={format}
          onEventClick={onEventClick}
          className={
            overlayMore
              ? 'absolute z-30 border border-divider bg-overlay px-1.5'
              : 'absolute z-20 flex items-start justify-center bg-surface-secondary pt-1'
          }
          style={
            overlayMore
              ? {
                  top: Math.max(Math.min(...hidden.map(segment => segment.top)), cluster.top + 1.75 * remPx),
                  right: INSET_PX + 2,
                }
              : {
                  top: cluster.top,
                  height: Math.max(cluster.bottom - cluster.top, MIN_EVENT_PX),
                  right: INSET_PX,
                  width: moreWidth - GAP_PX,
                }
          }
        />
      )}
    </>
  );
}
