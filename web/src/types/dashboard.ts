import type { BalancePoint, UserStats } from './user';

export type EventKind = 'checkin' | 'auction' | 'lottery' | 'calendar';

export interface FeedEvent {
  id: string;
  kind: EventKind;
  title: string;
  subtitle: string;
  timeLabel: string;
  urgency: 'high' | 'medium' | 'low';
}

export interface Announcement {
  id: number;
  title: string;
  date: string;
  pinned: boolean;
  content: string;
}

export interface GuildStats {
  members: number;
  activeEvents: number;
  balance: number;
  checkinsThisWeek: number;
  activeAuctions: number;
  openLotteries: number;
}

export type PersonalStats = UserStats;

export interface DashboardData {
  guildStats: GuildStats;
  personalStats: PersonalStats;
  balanceTrend: BalancePoint[];
  incomingEvents: FeedEvent[];
  announcements: Announcement[];
}
