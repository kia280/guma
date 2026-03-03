import { ItemCategory, ItemRarity } from './auction';

export interface BackpackItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  acquiredFrom: 'auction' | 'lottery' | 'transfer' | 'admin';
  acquiredAt: string;
  ownerId: string;
  guildId: string;
  imageUrl?: string;
  note?: string;
}
