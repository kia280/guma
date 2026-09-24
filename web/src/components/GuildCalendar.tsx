'use client';

import React, { useState, useEffect } from 'react';
import { Card, Button, ButtonGroup, Chip, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import {
  GuildEvent,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  PRIORITY_COLORS,
} from '@/types/guild-events';

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

const TIMELINE_COLORS: Record<string, { border: string; bg: string }> = {
  danger: { border: 'rgb(var(--heroui-danger))', bg: 'color-mix(in oklab, rgb(var(--heroui-danger)) 12%, transparent)' },
  warning: { border: 'rgb(var(--heroui-warning))', bg: 'color-mix(in oklab, rgb(var(--heroui-warning)) 12%, transparent)' },
  primary: { border: 'rgb(var(--heroui-accent))', bg: 'color-mix(in oklab, rgb(var(--heroui-accent)) 12%, transparent)' },
  secondary: { border: 'rgb(var(--heroui-accent))', bg: 'color-mix(in oklab, rgb(var(--heroui-accent)) 12%, transparent)' },
  success: { border: 'rgb(var(--heroui-success))', bg: 'color-mix(in oklab, rgb(var(--heroui-success)) 12%, transparent)' },
  default: { border: 'rgb(var(--heroui-default-500))', bg: 'color-mix(in oklab, rgb(var(--heroui-default-500)) 12%, transparent)' },
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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return isSameDay(eventDate, date);
    });
  };

  const getCalendarDays = () => {
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

  const getWeekDays = () => {
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

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateChange(date);
    if (onDateClick) {
      onDateClick(date);
    }
  };

  // --- Timeline helpers ---

  const getEventTop = (startDate: string): number => {
    const d = new Date(startDate);
    return d.getHours() * HOUR_PX + d.getMinutes(); // 1px per minute
  };

  const getEventHeight = (startDate: string, endDate?: string): number => {
    if (!endDate) return HOUR_PX;
    const durationMinutes = (new Date(endDate).getTime() - new Date(startDate).getTime()) / 60_000;
    return Math.max(durationMinutes, 30);
  };

  const getCurrentTimeTop = (): number => {
    return currentTime.getHours() * HOUR_PX + currentTime.getMinutes();
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

  const renderDayColumn = (dayEvents: GuildEvent[], isToday: boolean) => {
    const timedEvents = dayEvents.filter(e => !e.isAllDay);
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
        {timedEvents.map(event => {
          const colorKey = EVENT_TYPE_COLORS[event.type];
          const colors = TIMELINE_COLORS[colorKey] ?? TIMELINE_COLORS.default;
          const top = getEventTop(event.startDate);
          const height = Math.max(getEventHeight(event.startDate, event.endDate), 24);
          return (
            <div
              key={event.id}
              style={{
                top,
                height,
                left: '3px',
                right: '3px',
                backgroundColor: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
              }}
              className="absolute rounded-r-md overflow-hidden cursor-pointer z-20 hover:opacity-80 transition-opacity px-1.5 py-0.5"
              onClick={() => onEventClick(event)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && onEventClick(event)}
            >
              <p className="type-label text-foreground truncate">
                {event.title}
              </p>
              {height >= 40 && (
                <p className="type-caption text-subtle">
                  {formatTime(event.startDate)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // --- View renderers ---

  const renderMonthView = () => {
    const days = getCalendarDays();
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
              onClick={() => handleDateClick(day)}
              onKeyDown={e => e.key === 'Enter' && handleDateClick(day)}
              role="button"
              tabIndex={0}
              className={`cursor-pointer h-full
                min-h-[80px] border shadow-none transition-colors
                ${!isCurrentMonth ? 'opacity-30' : ''}
                ${isToday ? 'border-accent/50 bg-accent/5' : 'border-divider bg-surface'}
                ${isSelected && !isToday ? 'border-foreground/20 bg-surface-secondary' : ''}
              `}
            >
              <Card.Content className="p-1.5 h-full">
                <div className="flex flex-col h-full">
                  <div
                    className={`type-label text-center mb-1 ${isToday ? 'text-accent' : 'text-foreground'}`}
                  >
                    {day.getDate()}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map(event => (
                      <Tooltip key={event.id}>
                        <div
                          onClick={e => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              onEventClick(event);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer"
                        >
                          <Chip
                            color={EVENT_TYPE_COLORS[event.type]}
                            size="sm"
                            variant="secondary"
                            className="type-caption truncate max-w-full"
                          >
                            {event.title.length > 8 ? `${event.title.slice(0, 8)}...` : event.title}
                          </Chip>
                        </div>
                        <Tooltip.Content>
                          {`${event.title} - ${formatTime(event.startDate)}`}
                        </Tooltip.Content>
                      </Tooltip>
                    ))}

                    {dayEvents.length > 2 && (
                      <div className="type-caption text-hint text-center">
                        +{dayEvents.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              </Card.Content>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate);
    const isToday = isSameDay(currentDate, new Date());
    const allDayEvents = dayEvents.filter(e => e.isAllDay);

    return (
      <div className="flex flex-col h-full min-h-[480px] border border-divider rounded-xl overflow-hidden bg-surface">
        {/* Day header */}
        <div className={`px-4 py-3 border-b border-divider ${isToday ? 'bg-accent/5' : ''}`}>
          <h3 className={`type-subheading ${isToday ? 'text-accent' : 'text-foreground'}`}>
            {formatDate(currentDate)}
          </h3>
          {allDayEvents.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allDayEvents.map(event => (
                <div
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => onEventClick(event)}
                  onKeyDown={e => e.key === 'Enter' && onEventClick(event)}
                  role="button"
                  tabIndex={0}
                >
                  <Chip size="sm" color={EVENT_TYPE_COLORS[event.type]} variant="secondary">
                    {event.title}
                  </Chip>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 24h timeline */}
        <div className="flex flex-1 min-h-0 overflow-y-auto">
          {renderHourLabels()}
          <div className="flex-1 border-l border-divider">
            {renderDayColumn(dayEvents, isToday)}
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    const today = new Date();

    return (
      <div className="flex flex-col h-full min-h-[480px] border border-divider rounded-xl overflow-hidden bg-surface">
        {/* Day column headers */}
        <div className="flex border-b border-divider">
          <div className="w-14 shrink-0 border-r border-divider" />
          {days.map((day, index) => {
            const isToday = isSameDay(day, today);
            const allDayEvs = getEventsForDate(day).filter(e => e.isAllDay);
            return (
              <div
                key={index}
                className={`flex-1 px-1 py-2 text-center border-l border-divider cursor-pointer transition-colors ${isToday ? 'bg-accent/5' : 'hover:bg-surface-secondary'}`}
                onClick={() => handleDateClick(day)}
                onKeyDown={e => e.key === 'Enter' && handleDateClick(day)}
                role="button"
                tabIndex={0}
              >
                <div className="type-label text-hint">
                  {day.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`type-subheading tabular-nums mt-0.5 ${isToday ? 'text-accent' : 'text-foreground'}`}
                >
                  {day.getDate()}
                </div>
                {allDayEvs.length > 0 && (
                  <div className="flex justify-center gap-0.5 mt-1">
                    {allDayEvs.slice(0, 3).map(e => (
                      <div
                        key={e.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor:
                            TIMELINE_COLORS[EVENT_TYPE_COLORS[e.type]]?.border ?? 'var(--muted)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 24h timeline grid */}
        <div className="flex flex-1 min-h-0 overflow-y-auto">
          {renderHourLabels()}
          {days.map((day, index) => {
            const isToday = isSameDay(day, today);
            const dayEvents = getEventsForDate(day);
            return (
              <div
                key={index}
                className={`flex-1 border-l border-divider ${isToday ? 'bg-accent/5' : ''}`}
              >
                {renderDayColumn(dayEvents, isToday)}
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
        return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      case 'week': {
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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
