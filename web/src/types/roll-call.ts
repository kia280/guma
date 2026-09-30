// Roll call types

import type { ItemCategory, ItemRarity } from '@/types/item';

export enum RollCallStatus {
  OPEN = 1,
  CANCELLED = 2,
  FINISHED = 3,
  COMPLETED = 4,
}

export interface Attendee {
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

export interface RollCallGoldPot {
  total: number;
  distributed: number;
  retracted: number;
  kept: number;
  remaining: number;
}

export interface RollCallGoldPayout {
  userId: string;
  amount: number;
}

export interface RollCallGoldSummary {
  pot?: RollCallGoldPot;
  recipients: RollCallGoldPayout[];
}

export interface RollCallGoldDistribution {
  pot: RollCallGoldPot;
  payouts: RollCallGoldPayout[];
  replayed: boolean;
}

export interface RollCall {
  id: string;
  status: RollCallStatus;
  date: string;
  title: string;
  description?: string;
  expireTime?: string;
  attendanceCount: number;
  attendanceList: Attendee[];
  lootList: LootItem[];
  goldLoot?: RollCallGoldPot;
  isDisabled?: boolean;
  imageUrl?: string;
  completedAt?: string;
}

export interface CreateRollCallRequest {
  title: string;
  description?: string;
  datetime?: string;
  expireTime?: string;
  imageUrl?: string;
  lootList?: LootEntry[];
}

export interface UpdateRollCallRequest {
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

export interface RollCallTemplate {
  id: string;
  name: string;
  title: string;
  items: ItemTemplate[];
}

export interface RollCallTemplateInput {
  name: string;
  title: string;
  itemTemplateIds: string[];
}
