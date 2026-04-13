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
