import { AuctionStatus } from '@/types/auction';
import { CheckinStatus } from '@/types/checkin';
import type { GuildContribution, RequestStatus } from '@/types/guild-bank';
import type { LotteryStatus } from '@/types/lottery';
import type { Transaction } from '@/types/wallet';

export type StatusColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export type UserStatus = 'online' | 'offline' | 'banned';

export const contributionStatusColor: Record<GuildContribution['status'], StatusColor> = {
  completed: 'success',
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
};

export const requestStatusColor: Record<RequestStatus, StatusColor> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export const transactionStatusColor: Record<Transaction['status'], StatusColor> = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
};

export const userStatusColor: Record<UserStatus, StatusColor> = {
  online: 'success',
  offline: 'default',
  banned: 'danger',
};

export const lotteryStatusColor: Record<LotteryStatus, StatusColor> = {
  active: 'success',
  upcoming: 'warning',
  ended: 'default',
  cancelled: 'default',
};

export const auctionStatusColor: Record<AuctionStatus, StatusColor> = {
  [AuctionStatus.ACTIVE]: 'success',
  [AuctionStatus.UPCOMING]: 'warning',
  [AuctionStatus.ENDED]: 'default',
  [AuctionStatus.CANCELLED]: 'default',
};

export const checkinStatusColor: Record<CheckinStatus, StatusColor> = {
  [CheckinStatus.OPEN]: 'success',
  [CheckinStatus.CANCELLED]: 'default',
  [CheckinStatus.FINISHED]: 'warning',
  [CheckinStatus.COMPLETED]: 'accent',
};
