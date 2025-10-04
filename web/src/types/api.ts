// Base API types
export interface APIResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User and Authentication types
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  guilds: Guild[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  provider: 'discord' | 'oauth2';
  code?: string;
  redirectUri?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

// Guild types
export interface Guild {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  ownerId: string;
  memberCount: number;
  settings: GuildSettings;
  createdAt: string;
  updatedAt: string;
}

export interface GuildSettings {
  timezone: string;
  language: string;
  currency: string;
  features: {
    economy: boolean;
    events: boolean;
    raids: boolean;
    voting: boolean;
  };
}

export interface GuildMember {
  id: string;
  userId: string;
  guildId: string;
  user: User;
  nickname?: string;
  roles: GuildRole[];
  joinedAt: string;
  isActive: boolean;
}

export interface GuildRole {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  isDefault: boolean;
}

// Event types
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

// Plugin types
export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  repository?: string;
  isEnabled: boolean;
  config: Record<string, any>;
  permissions: string[];
  dependencies: string[];
  installedAt: string;
}

export interface PluginComponent {
  name: string;
  component: string;
  route?: string;
  permissions?: string[];
  navItem?: {
    label: string;
    icon: string;
    order: number;
  };
}

// Wallet/Economy types
export interface Wallet {
  id: string;
  userId: string;
  guildId: string;
  balance: number;
  currency: string;
  transactions: Transaction[];
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  walletId: string;
  type: TransactionType;
  amount: number;
  description: string;
  reference?: string;
  createdAt: string;
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  REWARD = 'reward',
  PENALTY = 'penalty',
}

// System types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    api: ServiceStatus;
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: string;
}

// Form types
export interface FormErrors {
  [key: string]: string | string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Query types for React Query
export interface QueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload: any;
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