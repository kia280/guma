// Participant-driven event types (raids, meetings, tournaments).
// For calendar-style events (boss respawns, guild wars), see guild-events.ts.

import type { User } from './user';

export interface Event {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  startTime: string;
  endTime?: string;
  location?: string;
  maxParticipants?: number;
  participants: EventParticipant[];
  createdBy: string;
  guildId: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export enum EventType {
  RAID = 'raid',
  MEETING = 'meeting',
  TOURNAMENT = 'tournament',
  SOCIAL = 'social',
  OTHER = 'other',
}

export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface EventParticipant {
  id: string;
  userId: string;
  eventId: string;
  user: User;
  status: ParticipantStatus;
  joinedAt: string;
}

export enum ParticipantStatus {
  JOINED = 'joined',
  MAYBE = 'maybe',
  DECLINED = 'declined',
}
