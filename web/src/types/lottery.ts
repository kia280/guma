// Lottery types

import type { ItemSourceRef } from './item';

export type LotteryStatus = 'active' | 'upcoming' | 'ended' | 'cancelled';

export interface LotteryWinner {
  id: string;
  userId?: string;
  username: string;
  avatar?: string;
  prize: string;
  prizeAmount?: number;
}

export interface LotteryParticipant {
  id: string;
  username: string;
  avatar?: string;
  tickets: number;
}

export interface LotteryPrize {
  rank: number;
  description: string;
  amount?: number;
  itemName?: string;
}

export interface Lottery {
  id: string;
  title: string;
  description?: string;
  prizePool: number;
  prizes?: LotteryPrize[];
  ticketPrice: number;
  drawDate: string;
  ticketsSold: number;
  maxTickets: number;
  status: LotteryStatus;
  cancelledAt?: string;
  winners?: LotteryWinner[];
  participants?: LotteryParticipant[];
}

export interface LotteryTicket {
  id: string;
  lotteryId: string;
  userId: string;
  ticketNumber: string;
  purchasedAt: string;
}

export interface CreateLotteryRequest {
  title: string;
  description?: string;
  ticketPrice: number;
  maxTickets?: number;
  maxTicketsPerUser?: number;
  drawDate: string;
  prizes?: Array<{ rank: number; description: string; amount?: number; source?: ItemSourceRef }>;
}

export interface UpdateLotteryRequest {
  title?: string;
  description?: string;
  drawDate?: string;
  ticketPrice?: number;
  maxTickets?: number;
}
