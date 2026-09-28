import type { Item, ItemLock } from './item';

export type BackpackItemSource = 'auction' | 'lottery' | 'transfer' | 'bank' | 'rollCall' | 'admin';

export interface BackpackItem {
  id: string;
  item: Item;
  acquiredFrom: BackpackItemSource;
  sourceId?: string;
  sourceLabel?: string;
  acquiredAt: string;
  ownerId: string;
  guildId: string;
  note?: string;
  deliveryRequestedAt?: string;
  ownerName?: string;
  lock?: ItemLock;
}
