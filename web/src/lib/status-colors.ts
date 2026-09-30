import { AuctionStatus } from '@/types/auction';
import type { GuildContribution, RequestStatus } from '@/types/guild-bank';
import type { RaffleStatus } from '@/types/raffle';
import { RollCallStatus } from '@/types/roll-call';
import type { Transaction, WithdrawalStatus } from '@/types/wallet';

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

export const withdrawalStatusColor: Record<WithdrawalStatus, StatusColor> = {
  ...requestStatusColor,
  cancelled: 'default',
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

export const raffleStatusColor: Record<RaffleStatus, StatusColor> = {
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

export const rollCallStatusColor: Record<RollCallStatus, StatusColor> = {
  [RollCallStatus.OPEN]: 'success',
  [RollCallStatus.CANCELLED]: 'default',
  [RollCallStatus.FINISHED]: 'warning',
  [RollCallStatus.COMPLETED]: 'accent',
};
