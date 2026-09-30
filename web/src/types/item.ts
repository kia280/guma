// Shared item type — mirrors proto `guma.v1.Item`.
// Used as the nested shape inside `AuctionItem`, `BackpackItem`, etc.

export enum ItemCategory {
  WEAPON = 'weapon',
  ARMOR = 'armor',
  ACCESSORY = 'accessory',
  CONSUMABLE = 'consumable',
  SKILL_SCROLL = 'skill_scroll',
  MATERIAL = 'material',
  MISC = 'misc',
}

export enum ItemRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
  MYTHIC = 'mythic',
}

export interface Item {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
}

export interface ItemSourceRef {
  backpackItemId?: string;
  bankItemId?: string;
}

export interface ItemLock {
  type: 'auction' | 'raffle';
  id: string;
}

export type ItemHistoryKind =
  | 'looted'
  | 'donated'
  | 'requested'
  | 'request_approved'
  | 'request_rejected'
  | 'received'
  | 'auction_listed'
  | 'raffle_listed'
  | 'returned'
  | 'withdrawn'
  | 'retracted'
  | 'withdrawal_requested'
  | 'withdrawal_cancelled'
  | 'delivered'
  | 'kept';

export interface ItemHistoryEvent {
  id: string;
  kind: ItemHistoryKind;
  source: string;
  actorId?: string;
  actorName: string;
  subjectId?: string;
  subjectName: string;
  referenceId?: string;
  referenceLabel: string;
  createdAt: string;
}
