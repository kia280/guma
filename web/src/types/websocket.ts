// WebSocket message types

import type { Event, EventParticipant } from './event';

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface NotificationMessage extends WebSocketMessage {
  type: 'notification';
  payload: {
    id: string;
    title: string;
    message: string;
    level: 'info' | 'success' | 'warning' | 'error';
    userId?: string;
    guildId?: string;
  };
}

export interface EventUpdateMessage extends WebSocketMessage {
  type: 'event_update';
  payload: {
    eventId: string;
    action: 'created' | 'updated' | 'deleted' | 'participant_joined' | 'participant_left';
    event?: Event;
    participant?: EventParticipant;
  };
}
