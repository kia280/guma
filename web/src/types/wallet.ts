// Wallet and transaction types

export interface Wallet {
  id: string;
  userId: string;
  guildId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  type: 'transfer' | 'withdraw' | 'deposit';
  amount: number;
  recipient?: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  description?: string;
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
