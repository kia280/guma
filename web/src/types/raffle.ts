// Raffle types

import type { ItemSourceRef } from './item';

export type RaffleStatus = 'active' | 'upcoming' | 'ended' | 'cancelled';

export interface RaffleWinner {
  id: string;
  userId?: string;
  username: string;
  avatar?: string;
  prize: string;
  prizeAmount?: number;
}

export interface RaffleParticipant {
  id: string;
  username: string;
  avatar?: string;
  tickets: number;
}

export interface RafflePrize {
  rank: number;
  description: string;
  amount?: number;
  itemName?: string;
}

export interface Raffle {
  id: string;
  title: string;
  description?: string;
  prizePool: number;
  prizes?: RafflePrize[];
  ticketPrice: number;
  drawDate: string;
  ticketsSold: number;
  maxTickets: number;
  status: RaffleStatus;
  cancelledAt?: string;
  winners?: RaffleWinner[];
  participants?: RaffleParticipant[];
}

export interface RaffleTicket {
  id: string;
  raffleId: string;
  userId: string;
  ticketNumber: string;
  purchasedAt: string;
}

export interface CreateRaffleRequest {
  title: string;
  description?: string;
  ticketPrice: number;
  maxTickets?: number;
  maxTicketsPerUser?: number;
  drawDate: string;
  prizes?: Array<{ rank: number; description: string; amount?: number; source?: ItemSourceRef }>;
}

export interface UpdateRaffleRequest {
  title?: string;
  description?: string;
  drawDate?: string;
  ticketPrice?: number;
  maxTickets?: number;
}
