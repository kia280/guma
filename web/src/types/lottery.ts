// Lottery types

export type LotteryStatus = 'active' | 'upcoming' | 'ended';

export interface LotteryWinner {
  id: string;
  username: string;
  prize: string;
}

export interface Lottery {
  id: string;
  title: string;
  prizePool: number;
  ticketPrice: number;
  drawDate: string;
  ticketsSold: number;
  maxTickets: number;
  status: LotteryStatus;
  winners?: LotteryWinner[];
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
  prizes?: Array<{ rank: number; description: string; amount?: number }>;
}
