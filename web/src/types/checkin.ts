// Check-in event types

import type { ItemCategory, ItemRarity } from '@/types/item';

export enum CheckinStatus {
  OPEN = 1,
  CLOSED = 2,
  FINISHED = 3,
}

export interface AttendanceMember {
  id: string;
  userId?: string;
  username: string;
  checkedInAt: string;
  notes?: string;
}

export interface LootItem {
  id: string;
  name: string;
  quantity?: number;
  winner?: string;
}

export interface CheckinEntry {
  id: string;
  status: CheckinStatus;
  date: string;
  description: string;
  expireTime?: string;
  attendanceList: AttendanceMember[];
  lootList: LootItem[];
  isDisabled?: boolean;
  imageUrl?: string;
}

export interface CreateCheckinRequest {
  title: string;
  description?: string;
  datetime?: string;
  expireTime?: string;
  imageUrl?: string;
  lootList?: LootEntry[];
}

export interface UpdateCheckinRequest extends Partial<CreateCheckinRequest> {}

export interface LootEntry {
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
