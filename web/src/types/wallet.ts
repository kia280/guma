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
}

export interface DepositRequest {
  amount: number;
}

export interface WithdrawRequest {
  amount: number;
}

export interface TransferRequest {
  recipientId: string;
  amount: number;
}
