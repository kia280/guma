// Guild bank types

import type { ItemCategory, ItemRarity } from './item';

/**
 * Unified activity entry for the guild bank history view.
 * The backend has separate message types (BankContribution, FundRequest,
 * BankItem donation, ItemRequest); transforms merge them into this shape
 * using `type` as a discriminator.
 */
export interface GuildContribution {
  id: string;
  type: 'contribute' | 'request' | 'item_donate' | 'item_distribute';
  amount?: number;
  itemName?: string;
  member: string;
  memberAvatar?: string;
  date: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  note?: string;
}

export interface GuildBankItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  donatedBy: string;
  donatedAt: string;
  quantity: number;
}

export interface GuildBank {
  id: string;
  guildId: string;
  balance: number;
  currency: string;
  goal: number;
  updatedAt: string;
}

export interface BankContribution {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  amount: number;
  note?: string;
  createdAt: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type ReviewDecision = Exclude<RequestStatus, 'pending'>;

export interface FundRequest {
  id: string;
  guildId: string;
  requesterId: string;
  requesterName: string;
  amount: number;
  reason: string;
  status: RequestStatus;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface ItemRequest {
  id: string;
  guildId: string;
  bankItemId: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: RequestStatus;
  itemName: string;
  itemCategory: ItemCategory;
  itemRarity: ItemRarity;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}
