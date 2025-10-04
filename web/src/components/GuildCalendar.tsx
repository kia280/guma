'use client';

import React, { useState } from 'react';
import {
  Card,
  CardBody,
  Button,
  ButtonGroup,
  Chip,
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Badge,
  Divider,
} from '@heroui/react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { GuildEvent, EVENT_TYPE_COLORS, EVENT_TYPE_LABELS, PRIORITY_COLORS } from '@/types/guild-events';

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Helper functions
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

  const renderMonthView = () => {
    const days = getCalendarDays();
    const today = new Date();

    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Week headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-small font-medium text-default-500">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isToday = isSameDay(day, today);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <Card
              key={index}
              isPressable
              onPress={() => handleDateClick(day)}
              className={`
                min-h-[80px] transition-all
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-primary/10' : ''}
              `}
            >
              <CardBody className="p-1">
                <div className="flex flex-col h-full">
                  <div className={`text-small text-center mb-1 ${isToday ? 'font-bold text-primary' : ''}`}>
                    {day.getDate()}
                  </div>
                  
                  <div className="flex-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <Tooltip key={event.id} content={`${event.title} - ${formatTime(event.startDate)}`}>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          className="cursor-pointer"
                        >
                          <Chip
                            color={EVENT_TYPE_COLORS[event.type] as any}
                            size="sm"
                            variant="flat"
                            className="text-xs truncate max-w-full"
                          >
                            {event.title.length > 8 ? `${event.title.slice(0, 8)}...` : event.title}
                          </Chip>
                        </div>
                      </Tooltip>
                    ))}
                    
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-default-400 text-center">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getWeekDays();
    const today = new Date();

    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <Card
              key={index}
              isPressable
              onPress={() => handleDateClick(day)}
              className={`
                min-h-[300px] transition-all
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-primary/10' : ''}
              `}
            >
              <CardBody className="p-3">
                <div className="flex flex-col h-full">
                  <div className={`text-center mb-3 ${isToday ? 'text-primary' : ''}`}>
                    <div className="text-small font-medium">
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-large ${isToday ? 'font-bold' : ''}`}>
                      {day.getDate()}
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    {dayEvents.map((event) => (
                      <Card
                        key={event.id}
                        isPressable
                        onPress={() => onEventClick(event)}
                        className="bg-content2/50"
                      >
                        <CardBody className="p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Chip
                              color={EVENT_TYPE_COLORS[event.type] as any}
                              size="sm"
                              variant="flat"
                            >
                              {EVENT_TYPE_LABELS[event.type]}
                            </Chip>
                            {event.priority === 'critical' && (
                              <Badge color="danger" size="sm" variant="flat">
                                !
                              </Badge>
                            )}
                          </div>
                          <div className="text-small font-medium truncate">
                            {event.title}
                          </div>
                          <div className="text-xs text-default-500 flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />
                            {event.isAllDay ? 'All Day' : formatTime(event.startDate)}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderDayView = () => {
    const dayEvents = getEventsForDate(currentDate).sort((a, b) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    return (
      <div className="space-y-4">
        <Card>
          <CardBody className="p-4">
            <h3 className="text-large font-semibold mb-3">
              {formatDate(currentDate)}
            </h3>
            
            <div className="space-y-3">
              {dayEvents.length === 0 ? (
                <div className="text-center text-default-500 py-8">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No events scheduled for this day</p>
                </div>
              ) : (
                dayEvents.map((event) => (
                  <Card
                    key={event.id}
                    isPressable
                    onPress={() => onEventClick(event)}
                    className="bg-content2/50 hover:bg-content2 transition-colors"
                  >
                    <CardBody className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Chip
                            color={EVENT_TYPE_COLORS[event.type] as any}
                            size="sm"
                            variant="flat"
                          >
                            {EVENT_TYPE_LABELS[event.type]}
                          </Chip>
                          <Chip
                            color={PRIORITY_COLORS[event.priority] as any}
                            size="sm"
                            variant="dot"
                          >
                            {event.priority}
                          </Chip>
                        </div>
                        
                        <div className="text-small text-default-500 flex items-center gap-1">
                          <ClockIcon className="w-4 h-4" />
                          {event.isAllDay ? 'All Day' : formatTime(event.startDate)}
                        </div>
                      </div>
                      
                      <h4 className="font-semibold mb-1">{event.title}</h4>
                      
                      {event.description && (
                        <p className="text-small text-default-600 mb-2">
                          {event.description}
                        </p>
                      )}
                      
                      {event.location && (
                        <div className="text-small text-default-500">
                          📍 {event.location}
                        </div>
                      )}
                      
                      {event.isRecurring && (
                        <div className="text-small text-default-500 mt-2">
                          🔄 Recurring {event.recurringPattern?.type}
                        </div>
                      )}
                    </CardBody>
                  </Card>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    );
  };

  const getViewTitle = () => {
    switch (view) {
      case 'month':
        return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      case 'week':
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      case 'day':
        return formatDate(currentDate);
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <Card>
        <CardBody className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                isIconOnly
                variant="flat"
                onPress={() => onNavigate('prev')}
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </Button>
              
              <h2 className="text-xl font-semibold min-w-[200px] text-center">
                {getViewTitle()}
              </h2>
              
              <Button
                isIconOnly
                variant="flat"
                onPress={() => onNavigate('next')}
              >
                <ChevronRightIcon className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={() => onDateChange(new Date())}
              >
                Today
              </Button>
              
              <ButtonGroup size="sm">
                <Button
                  variant={view === 'day' ? 'solid' : 'flat'}
                  color={view === 'day' ? 'primary' : 'default'}
                  onPress={() => onViewChange('day')}
                >
                  Day
                </Button>
                <Button
                  variant={view === 'week' ? 'solid' : 'flat'}
                  color={view === 'week' ? 'primary' : 'default'}
                  onPress={() => onViewChange('week')}
                >
                  Week
                </Button>
                <Button
                  variant={view === 'month' ? 'solid' : 'flat'}
                  color={view === 'month' ? 'primary' : 'default'}
                  onPress={() => onViewChange('month')}
                >
                  Month
                </Button>
              </ButtonGroup>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Calendar Content */}
      <div>
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </div>
  );
};