'use client';

import { Card, Button, ButtonGroup, Chip, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React, { useState, useEffect, useMemo } from 'react';
import { Focusable } from 'react-aria-components';
import { useIntlLocale } from '@/i18n/useIntlFormatter';
import {
  EventOccurrence,
  endOfDay,
  expandEventOccurrences,
  occurrencesOnDay,
  startOfDay,
} from '@/lib/event-occurrences';
import { GuildEvent, EVENT_TYPE_COLORS } from '@/types/guild-events';

interface GuildCalendarProps {
  events: GuildEvent[];
  currentDate: Date;
  view: 'month' | 'week' | 'day';
  onDateChange: (date: Date) => void;
  onViewChange: (view: 'month' | 'week' | 'day') => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onEventClick: (event: GuildEvent) => void;
  onDateClick?: (date: Date) => void;
}

const HOUR_PX = 60; // pixels per hour
const TOTAL_HEIGHT = 24 * HOUR_PX; // 1440px
const MIN_EVENT_PX = 24;
const EVENT_INSET_PX = 3;
const EVENT_GAP_PX = 2;

interface PositionedEvent {
  occurrence: EventOccurrence;
  top: number;
  height: number;
  column: number;
  columns: number;
}

const isSameDay = (date1: Date, date2: Date) => {
  return date1.toDateString() === date2.toDateString();
};

const getCalendarDays = (currentDate: Date) => {
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startOfWeek = new Date(startOfMonth);
  startOfWeek.setDate(startOfMonth.getDate() - startOfMonth.getDay());
  const endOfWeek = new Date(endOfMonth);
  endOfWeek.setDate(endOfMonth.getDate() + (6 - endOfMonth.getDay()));

  const days = [];
  const currentDay = new Date(startOfWeek);

  while (currentDay <= endOfWeek) {
    days.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }

  return days;
};

const getWeekDays = (currentDate: Date) => {
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
};

const getVisibleDays = (currentDate: Date, view: GuildCalendarProps['view']) => {
  switch (view) {
    case 'month':
      return getCalendarDays(currentDate);
    case 'week':
      return getWeekDays(currentDate);
    default:
      return [currentDate];
  }
};

const TIMELINE_COLORS: Record<string, { border: string; bg: string }> = {
  danger: { border: 'var(--danger)', bg: 'color-mix(in oklab, var(--danger) 12%, transparent)' },
  warning: { border: 'var(--warning)', bg: 'color-mix(in oklab, var(--warning) 12%, transparent)' },
  primary: { border: 'var(--accent)', bg: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
  secondary: { border: 'var(--accent)', bg: 'color-mix(in oklab, var(--accent) 12%, transparent)' },
  success: { border: 'var(--success)', bg: 'color-mix(in oklab, var(--success) 12%, transparent)' },
  default: { border: 'var(--muted)', bg: 'color-mix(in oklab, var(--muted) 12%, transparent)' },
};

export const GuildCalendar: React.FC<GuildCalendarProps> = ({
  events,
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onNavigate,
  onEventClick,
  onDateClick,
}) => {
  const t = useTranslations('guildCalendar');
  const intlLocale = useIntlLocale();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(intlLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(intlLocale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const visibleDays = useMemo(() => getVisibleDays(currentDate, view), [currentDate, view]);

  const occurrences = useMemo(
    () =>
      expandEventOccurrences(
        events,
        startOfDay(visibleDays[0]),
        endOfDay(visibleDays[visibleDays.length - 1]),
      ),
    [events, visibleDays],
  );

  const getEventsForDate = (date: Date) => occurrencesOnDay(occurrences, date);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateChange(date);
    if (onDateClick) {
      onDateClick(date);
    }
  };

  // --- Timeline helpers ---

  const minutesIntoDay = (date: Date) => date.getHours() * HOUR_PX + date.getMinutes();

  const getDaySegment = (occurrence: EventOccurrence, day: Date) => {
    const top = isSameDay(occurrence.start, day) ? minutesIntoDay(occurrence.start) : 0;
    let bottom: number;
    if (!occurrence.event.endDate) {
      bottom = top + HOUR_PX;
    } else if (isSameDay(occurrence.end, day)) {
      bottom = minutesIntoDay(occurrence.end);
    } else {
      bottom = TOTAL_HEIGHT;
    }
    const height = Math.min(Math.max(bottom - top, 30, MIN_EVENT_PX), TOTAL_HEIGHT - top);
    return { top, height };
  };

  const getCurrentTimeTop = (): number => {
    return currentTime.getHours() * HOUR_PX + currentTime.getMinutes();
  };

  const layoutTimedEvents = (timedEvents: EventOccurrence[], day: Date): PositionedEvent[] => {
    const sorted = timedEvents
      .map(occurrence => {
        const { top, height } = getDaySegment(occurrence, day);
        return { occurrence, top, height, bottom: top + height, column: 0 };
      })
      .sort((a, b) => a.top - b.top || b.height - a.height);

    const positioned: PositionedEvent[] = [];
    let group: typeof sorted = [];
    let columnEnds: number[] = [];
    let groupEnd = 0;

    const flushGroup = () => {
      const columns = columnEnds.length;
      group.forEach(({ occurrence, top, height, column }) => {
        positioned.push({ occurrence, top, height, column, columns });
      });
      group = [];
      columnEnds = [];
    };

    sorted.forEach(item => {
      if (item.top >= groupEnd) flushGroup();
      let column = columnEnds.findIndex(end => end <= item.top);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.bottom);
      } else {
        columnEnds[column] = item.bottom;
      }
      item.column = column;
      group.push(item);
      groupEnd = Math.max(groupEnd, item.bottom);
    });
    flushGroup();

    return positioned;
  };

  // --- Shared timeline sub-renderers ---

  const renderHourLabels = () => (
    <div className="w-14 shrink-0 relative bg-surface z-10" style={{ height: TOTAL_HEIGHT }}>
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          style={{ top: h * HOUR_PX, height: HOUR_PX }}
          className="absolute w-full flex items-start justify-end pr-2 pt-1"
        >
          <span className="type-caption text-hint select-none">
            {String(h).padStart(2, '0')}:00
          </span>
        </div>
      ))}
    </div>
  );

  const renderDayColumn = (dayEvents: EventOccurrence[], day: Date, isToday: boolean) => {
    const timedEvents = dayEvents.filter(occurrence => !occurrence.event.isAllDay);
    return (
      <div className="relative" style={{ height: TOTAL_HEIGHT }}>
        {/* Horizontal hour grid lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            style={{ top: h * HOUR_PX, height: HOUR_PX }}
            className="absolute w-full border-b border-divider/30"
          />
        ))}

        {/* Current time indicator */}
        {isToday && (
          <div
            style={{ top: getCurrentTimeTop() }}
            className="absolute w-full z-10 pointer-events-none"
          >
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-danger absolute -left-1 -top-1" />
              <div className="border-t-2 border-danger w-full" />
            </div>
          </div>
        )}

        {/* Timed events */}
        {layoutTimedEvents(timedEvents, day).map(({ occurrence, top, height, column, columns }) => {
          const { event } = occurrence;
          const colorKey = EVENT_TYPE_COLORS[event.type];
          const colors = TIMELINE_COLORS[colorKey] ?? TIMELINE_COLORS.default;
          const columnWidth = `calc((100% - ${2 * EVENT_INSET_PX}px) / ${columns})`;
          return (
            <button
              key={occurrence.key}
              type="button"
              style={{
                top,
                height,
                left: `calc(${EVENT_INSET_PX}px + ${column} * ${columnWidth})`,
                width: columns > 1 ? `calc(${columnWidth} - ${EVENT_GAP_PX}px)` : columnWidth,
                backgroundColor: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
                boxShadow: '0 0 0 1px var(--surface)',
              }}
              className="absolute block text-left rounded-r-md overflow-hidden cursor-pointer z-20 hover:opacity-80 transition-opacity px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={() => onEventClick(event)}
            >
              <p className="type-label text-foreground truncate">
                {event.title}
              </p>
              {height >= 40 && (
                <p className="type-caption text-subtle truncate">
                  {formatTime(occurrence.start)}
                </p>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // --- View renderers ---

  const renderMonthView = () => {
    const days = visibleDays;
    const today = new Date();

    return (
      <div
        className="grid grid-cols-7 gap-1 h-full"
        style={{ gridTemplateRows: `auto repeat(${days.length / 7}, minmax(80px, 1fr))` }}
      >
        {(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const).map(day => (
          <div key={day} className="p-2 text-center type-label text-hint">
            {t(day)}
          </div>
        ))}

        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <Card
              key={index}
              className={`h-full min-h-[80px] p-0 border shadow-none transition-colors
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isToday ? 'border-accent/50 bg-accent/5' : 'border-divider bg-surface'}
                ${isSelected && !isToday ? 'border-foreground/20 bg-surface-secondary' : ''}
              `}
            >
              <button
                type="button"
                aria-label={formatDate(day)}
                aria-pressed={Boolean(isSelected)}
                onClick={() => handleDateClick(day)}
                className={`absolute inset-0 flex w-full items-start justify-center rounded-[inherit] cursor-pointer pt-1.5 type-label focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${isToday ? 'text-accent' : 'text-foreground'}`}
              >
                <span className="block leading-none">{day.getDate()}</span>
              </button>

              <div className="relative z-10 mt-6 px-1.5 pb-1.5 space-y-0.5 pointer-events-none">
                {dayEvents.slice(0, 2).map(({ key, event, start }) => (
                  <Tooltip key={key}>
                    <Focusable>
                      <button
                        type="button"
                        onClick={() => onEventClick(event)}
                        className="block w-full text-left cursor-pointer pointer-events-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        <Chip
                          color={EVENT_TYPE_COLORS[event.type]}
                          size="sm"
                          variant="secondary"
                          className="type-caption truncate max-w-full"
                        >
                          {event.title.length > 8 ? `${event.title.slice(0, 8)}...` : event.title}
                        </Chip>
                      </button>
                    </Focusable>
                    <Tooltip.Content>
                      {`${event.title} - ${formatTime(start)}`}
                    </Tooltip.Content>
                  </Tooltip>
                ))}

                {dayEvents.length > 2 && (
                  <div className="type-caption text-hint text-center">+{dayEvents.length - 2}</div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const isToday = isSameDay(currentDate, new Date());
    const allDayEvents = dayEvents.filter(occurrence => occurrence.event.isAllDay);

    return (
      <div className="flex flex-col h-full min-h-[480px] border border-divider rounded-xl overflow-hidden bg-surface">
        {/* Day header */}
        <div className={`px-4 py-3 border-b border-divider ${isToday ? 'bg-accent/5' : ''}`}>
          <h3 className={`type-subheading ${isToday ? 'text-accent' : 'text-foreground'}`}>
            {formatDate(currentDate)}
          </h3>
          {allDayEvents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allDayEvents.map(({ key, event }) => (
                <button
                  key={key}
                  type="button"
                  className="cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  onClick={() => onEventClick(event)}
                >
                  <Chip size="sm" color={EVENT_TYPE_COLORS[event.type]} variant="secondary">
                    {event.title}
                  </Chip>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 24h timeline */}
        <div className="flex flex-1 min-h-0 overflow-y-auto">
          {renderHourLabels()}
          <div className="flex-1 border-l border-divider">
            {renderDayColumn(dayEvents, currentDate, isToday)}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = visibleDays;
    const today = new Date();

    return (
      <div className="flex flex-col h-full min-h-[480px] border border-divider rounded-xl overflow-hidden bg-surface">
        {/* Day column headers */}
        <div className="flex border-b border-divider overflow-y-hidden [scrollbar-gutter:stable]">
          <div className="w-14 shrink-0 border-r border-divider" />
          {days.map((day, index) => {
            const isToday = isSameDay(day, today);
            const allDayEvs = getEventsForDate(day).filter(occurrence => occurrence.event.isAllDay);
            return (
              <button
                key={index}
                type="button"
                aria-label={formatDate(day)}
                className={`flex-1 px-1 py-2 text-center border-l border-divider cursor-pointer transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus ${isToday ? 'bg-accent/5' : 'hover:bg-surface-secondary'}`}
                onClick={() => handleDateClick(day)}
              >
                <div className="type-label text-hint">
                  {day.toLocaleDateString(intlLocale, { weekday: 'short' })}
                </div>
                <div
                  className={`type-subheading tabular-nums mt-0.5 ${isToday ? 'text-accent' : 'text-foreground'}`}
                >
                  {day.getDate()}
                </div>
                {allDayEvs.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1">
                    {allDayEvs.slice(0, 3).map(({ key, event }) => (
                      <div
                        key={key}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            TIMELINE_COLORS[EVENT_TYPE_COLORS[event.type]]?.border ?? 'var(--muted)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 24h timeline grid */}
        <div className="flex flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
          {renderHourLabels()}
          {days.map((day, index) => {
            const isToday = isSameDay(day, today);
            const dayEvents = getEventsForDate(day);
            return (
              <div
                key={index}
                className={`flex-1 border-l border-divider ${isToday ? 'bg-accent/5' : ''}`}
              >
                {renderDayColumn(dayEvents, day, isToday)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getViewTitle = () => {
    switch (view) {
      case 'month':
        return currentDate.toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' });
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(intlLocale, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
      case 'day':
        return formatDate(currentDate);
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Calendar Header */}
      <Card className="border border-divider shadow-none bg-surface shrink-0">
        <Card.Content className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button
                isIconOnly
                variant="secondary"
                size="sm"
                aria-label={t('previous')}
                onPress={() => onNavigate('prev')}
              >
                <Icon icon="solar:alt-arrow-left-linear" width={16} />
              </Button>

              <h2 className="type-subheading text-foreground min-w-[180px] text-center">
                {getViewTitle()}
              </h2>

              <Button
                isIconOnly
                variant="secondary"
                size="sm"
                aria-label={t('next')}
                onPress={() => onNavigate('next')}
              >
                <Icon icon="solar:alt-arrow-right-linear" width={16} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  onDateChange(new Date());
                  onViewChange('day');
                }}
              >
                {t('today')}
              </Button>

              <ButtonGroup size="sm">
                <Button
                  variant={view === 'day' ? 'primary' : 'secondary'}
                  onPress={() => onViewChange('day')}
                >
                  {t('day')}
                </Button>
                <Button
                  variant={view === 'week' ? 'primary' : 'secondary'}
                  onPress={() => onViewChange('week')}
                >
                  {t('week')}
                </Button>
                <Button
                  variant={view === 'month' ? 'primary' : 'secondary'}
                  onPress={() => onViewChange('month')}
                >
                  {t('month')}
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Calendar Content */}
      <div className="flex-1 min-h-0">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </div>
  );
};
