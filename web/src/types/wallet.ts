import type { BackpackItem } from './backpack';

// Wallet and transaction types

export interface Wallet {
  id: string;
  userId: string;
  guildId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lockedInBids: number;
  lockedBids: LockedBid[];
  pendingWithdrawals: number;
}

export type WithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface WithdrawalRequest {
  id: string;
  guildId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl?: string;
  amount: number;
  note?: string;
  status: WithdrawalStatus;
  reviewerName?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface LockedBid {
  auctionId: string;
  itemName: string;
  amount: number;
  endTime: string;
}

export interface Transaction {
  id: string;
  type: 'transfer' | 'withdraw' | 'deposit';
  kind?: string;
  amount: number;
  recipient?: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
  referenceType?: string;
  referenceId?: string;
  actorName?: string;
  counterpartyName?: string;
}

export interface MemberAssetSummary {
  userId: string;
  balance: number;
  itemCount: number;
}

export interface MemberAssets {
  userId: string;
  balance: number;
  items: BackpackItem[];
}

export type AssetDestination = { kind: 'member'; userId: string } | { kind: 'bank' };

export interface AdminTransferFundsRequest {
  destination: AssetDestination;
  amount: number;
  note?: string;
}

export interface AdminTransferItemsRequest {
  destination: AssetDestination;
  itemIds: string[];
  note?: string;
}

export interface DepositRequest {
  amount: number;
}

export interface WithdrawRequest {
  amount: number;
  note?: string;
}

export interface TransferRequest {
  recipientId: string;
  amount: number;
}
