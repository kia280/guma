import type { Item, ItemLock } from './item';

export interface BackpackItem {
  id: string;
  item: Item;
  acquiredFrom: 'auction' | 'lottery' | 'transfer' | 'admin';
  acquiredAt: string;
  ownerId: string;
  guildId: string;
  note?: string;
  lock?: ItemLock;
}
