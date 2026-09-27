'use client';

import { Button, Card, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React, { useMemo, useRef } from 'react';
import { SelectedDayCard, UpcomingList } from '@/components/calendar/DayPanels';
import { MiniMonth } from '@/components/calendar/MiniMonth';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { TimelineView } from '@/components/calendar/TimelineView';
import { useCalendarFormat } from '@/hooks/useCalendarFormat';
import {
  addDays,
  type CalendarView,
  dayKey,
  type DeviceClass,
  fillsViewport,
  getMonthGridDays,
  getWeekDays,
  groupByDay,
  VIEWS_BY_DEVICE,
} from '@/lib/calendar';
import { type EventOccurrence, endOfDay, expandEventOccurrences, startOfDay } from '@/lib/event-occurrences';
import type { GuildEvent } from '@/types/guild-events';

interface GuildCalendarProps {
  events: GuildEvent[];
  currentDate: Date;
  view: CalendarView;
  device: DeviceClass;
  onDateChange: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onEventClick: (occurrence: EventOccurrence) => void;
  onCreate: () => void;
}

const UPCOMING_DAYS = 30;
const PANEL_UPCOMING_GROUPS = 5;

const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';

export const GuildCalendar: React.FC<GuildCalendarProps> = ({
  events,
  currentDate,
  view,
  device,
  onDateChange,
  onViewChange,
  onNavigate,
  onEventClick,
  onCreate,
}) => {
  const t = useTranslations('guildCalendar');
  const format = useCalendarFormat();
  const panelRef = useRef<HTMLDivElement>(null);
  const isPhone = device === 'phone';

  const selectedDay = useMemo(() => startOfDay(currentDate), [currentDate]);

  const visibleDays = useMemo(() => {
    if (view === 'week') return getWeekDays(currentDate);
    if (view === 'day') return [startOfDay(currentDate)];
    return getMonthGridDays(currentDate);
  }, [view, currentDate]);

  const upcomingDays = useMemo(
    () => Array.from({ length: UPCOMING_DAYS }, (_, index) => addDays(selectedDay, index + 1)),
    [selectedDay],
  );

  const occurrencesByDay = useMemo(() => {
    const days = [...visibleDays, ...upcomingDays];
    const times = days.map(day => day.getTime());
    const occurrences = expandEventOccurrences(
      events,
      startOfDay(new Date(Math.min(...times))),
      endOfDay(new Date(Math.max(...times))),
    );
    return groupByDay(occurrences, days);
  }, [events, visibleDays, upcomingDays]);

  const selectedOccurrences = occurrencesByDay.get(dayKey(selectedDay)) ?? [];
  const periodDays =
    view === 'month' || view === 'agenda'
      ? visibleDays.filter(day => day.getMonth() === currentDate.getMonth())
      : visibleDays;
  const periodIsEmpty = periodDays.every(day => (occurrencesByDay.get(dayKey(day)) ?? []).length === 0);

  const title = (() => {
    if (view === 'week') return format.weekRange(visibleDays[0], visibleDays[6]);
    if (view === 'day') return isPhone ? format.dayHeading(currentDate) : format.fullDate(currentDate);
    return format.month(currentDate);
  })();

  const showDay = (date: Date) => {
    onDateChange(date);
    if (device === 'tablet') {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() }));
    }
  };

  const openDay = (date: Date) => {
    onDateChange(date);
    onViewChange('day');
  };

  const selectedDayCard = (
    <SelectedDayCard
      day={selectedDay}
      occurrences={selectedOccurrences}
      format={format}
      onEventClick={onEventClick}
      onCreate={onCreate}
    />
  );

  const renderMonth = () => {
    const grid = (
      <MonthGrid
        days={visibleDays}
        currentDate={currentDate}
        occurrencesByDay={occurrencesByDay}
        format={format}
        showTimes={device === 'desktop'}
        onSelectDate={onDateChange}
        onShowDay={showDay}
        onEventClick={onEventClick}
      />
    );
    if (device === 'desktop') {
      return (
        <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem] gap-4">
          {grid}
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
            {selectedDayCard}
            <UpcomingList
              days={upcomingDays}
              occurrencesByDay={occurrencesByDay}
              format={format}
              onEventClick={onEventClick}
              maxDays={PANEL_UPCOMING_GROUPS}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-4">
        {grid}
        <div ref={panelRef} className="scroll-mt-4">
          {selectedDayCard}
        </div>
      </div>
    );
  };

  const renderAgenda = () => (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <Card className="border border-divider shadow-none bg-surface">
          <Card.Content className="p-2">
            <MiniMonth
              days={visibleDays}
              currentDate={currentDate}
              occurrencesByDay={occurrencesByDay}
              format={format}
              onSelectDate={onDateChange}
            />
          </Card.Content>
        </Card>
        {selectedDayCard}
      </div>
      <UpcomingList
        days={upcomingDays}
        occurrencesByDay={occurrencesByDay}
        format={format}
        onEventClick={onEventClick}
      />
    </div>
  );

  const viewSwitcher = (
    <ToggleButtonGroup
      aria-label={t('viewLabel')}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([view])}
      onSelectionChange={keys => {
        const [next] = keys;
        if (next) onViewChange(next as CalendarView);
      }}
      size="sm"
      fullWidth={isPhone}
    >
      {VIEWS_BY_DEVICE[device].map((option, index) => (
        <ToggleButton key={option} id={option} className="max-sm:h-11">
          {index > 0 && <ToggleButtonGroup.Separator />}
          {t(`views.${option}`)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  const todayButton = (
    <Button size="sm" variant="secondary" className="max-sm:h-11" onPress={() => onDateChange(new Date())}>
      {t('today')}
    </Button>
  );

  return (
    <div
      data-calendar-root
      className={`flex flex-col gap-4 ${fillsViewport(view, device) ? 'h-full min-h-0' : ''} ${isPhone ? 'pb-20' : ''}`}
    >
      <div className={isPhone ? 'flex flex-col gap-2' : 'flex flex-wrap items-center justify-between gap-3'}>
        <div className="flex min-w-0 items-center gap-1">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="max-sm:size-11"
            aria-label={t('previous')}
            onPress={() => onNavigate('prev')}
          >
            <Icon icon="solar:alt-arrow-left-linear" width={18} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="max-sm:size-11"
            aria-label={t('next')}
            onPress={() => onNavigate('next')}
          >
            <Icon icon="solar:alt-arrow-right-linear" width={18} />
          </Button>
          <h2 aria-live="polite" className="ml-1 min-w-0 flex-1 truncate type-heading tabular-nums text-foreground">
            {title}
          </h2>
          {isPhone && todayButton}
        </div>

        {isPhone ? (
          viewSwitcher
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {todayButton}
            {viewSwitcher}
            <Button size="sm" variant="primary" onPress={onCreate}>
              <Icon icon="solar:add-circle-linear" width={16} aria-hidden />
              {t('createEvent')}
            </Button>
          </div>
        )}
      </div>

      {periodIsEmpty && view !== 'agenda' && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-divider bg-surface px-4 py-3"
        >
          <Icon icon="solar:calendar-linear" width={22} className="shrink-0 text-disabled" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="type-body font-medium text-foreground">{t('noEventsPeriod', { period: view })}</p>
            <p className="type-caption text-hint">{t('noEventsHint')}</p>
          </div>
          {!isPhone && (
            <Button size="sm" variant="secondary" onPress={onCreate}>
              {t('createEvent')}
            </Button>
          )}
        </div>
      )}

      <div className={fillsViewport(view, device) ? 'min-h-0 flex-1' : ''}>
        {view === 'month' && renderMonth()}
        {view === 'agenda' && renderAgenda()}
        {(view === 'week' || view === 'day') && (
          <TimelineView
            days={visibleDays}
            occurrencesByDay={occurrencesByDay}
            format={format}
            onEventClick={onEventClick}
            onOpenDay={openDay}
          />
        )}
      </div>

      {isPhone && (
        <Button
          isIconOnly
          variant="primary"
          aria-label={t('createEvent')}
          onPress={onCreate}
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-4 z-30 size-14 rounded-full shadow-lg"
        >
          <Icon icon="solar:add-linear" width={26} aria-hidden />
        </Button>
      )}
    </div>
  );
};
