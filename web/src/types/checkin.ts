// Check-in event types

import type { ItemCategory, ItemRarity } from '@/types/item';

export enum CheckinStatus {
  OPEN = 1,
  CANCELLED = 2,
  FINISHED = 3,
  COMPLETED = 4,
}

export interface AttendanceMember {
  id: string;
  userId?: string;
  username: string;
  avatar?: string;
  checkedInAt: string;
  notes?: string;
}

export interface LootItem {
  id: string;
  name: string;
  description?: string;
  category?: ItemCategory;
  rarity?: ItemRarity;
  quantity?: number;
  winner?: string;
}

export type LootKind = 'item' | 'gold';

export interface CheckinGoldPot {
  total: number;
  distributed: number;
  retracted: number;
  remaining: number;
}

export interface CheckinGoldPayout {
  userId: string;
  amount: number;
}

export interface CheckinGoldSummary {
  pot?: CheckinGoldPot;
  recipients: CheckinGoldPayout[];
}

export interface CheckinGoldDistribution {
  pot: CheckinGoldPot;
  payouts: CheckinGoldPayout[];
  replayed: boolean;
}

export interface CheckinEntry {
  id: string;
  status: CheckinStatus;
  date: string;
  title: string;
  description?: string;
  expireTime?: string;
  attendanceCount: number;
  attendanceList: AttendanceMember[];
  lootList: LootItem[];
  goldLoot?: CheckinGoldPot;
  isDisabled?: boolean;
  imageUrl?: string;
  completedAt?: string;
}

export interface CreateCheckinRequest {
  title: string;
  description?: string;
  datetime?: string;
  expireTime?: string;
  imageUrl?: string;
  lootList?: LootEntry[];
}

export interface UpdateCheckinRequest {
  title: string;
  description: string;
  datetime: string;
  expireTime: string;
  imageUrl: string;
}

export interface LootEntry {
  id?: string;
  kind?: LootKind;
  amount?: number;
  name: string;
  quantity?: number;
  description?: string;
  category?: ItemCategory;
  rarity?: ItemRarity;
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
}

export type ItemTemplateInput = Omit<ItemTemplate, 'id'>;

export interface CheckinTemplate {
  id: string;
  name: string;
  title: string;
  items: ItemTemplate[];
}

export interface CheckinTemplateInput {
  name: string;
  title: string;
  itemTemplateIds: string[];
}
