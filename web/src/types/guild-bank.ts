// Guild bank types

import type { ItemCategory, ItemLock, ItemRarity } from './item';

/**
 * Unified activity entry for the guild bank history view.
 * The backend has separate message types (BankContribution, FundRequest,
 * BankItem donation, ItemRequest); transforms merge them into this shape
 * using `type` as a discriminator.
 */
export interface GuildContribution {
  id: string;
  type: 'contribute' | 'request' | 'item_donate' | 'item_distribute' | 'checkin_loot' | 'auction_proceeds' | 'lottery_revenue';
  amount?: number;
  itemName?: string;
  member: string;
  memberAvatar?: string;
  date: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  note?: string;
  checkinId?: string;
  href?: string;
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
  checkinId?: string;
  checkinTitle?: string;
  lock?: ItemLock;
}

export interface GuildBank {
  id: string;
  guildId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface BankContribution {
  id: string;
  guildId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  amount: number;
  note?: string;
  createdAt: string;
  kind: BankContributionKind;
  itemNames: string[];
  checkinId?: string;
  referenceType?: string;
  referenceId?: string;
}

export type BankContributionKind = 'gold' | 'checkin_loot' | 'auction_proceeds' | 'lottery_revenue';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export type ReviewDecision = Exclude<RequestStatus, 'pending'>;

export interface FundRequest {
  id: string;
  guildId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl?: string;
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
  requesterAvatarUrl?: string;
  reason: string;
  status: RequestStatus;
  itemName: string;
  itemCategory: ItemCategory;
  itemRarity: ItemRarity;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}
