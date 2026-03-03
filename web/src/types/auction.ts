// Auction types
export interface AuctionItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  startingBid: number;
  currentBid: number;
  currentBidder?: {
    id: string;
    username: string;
    avatar?: string;
  };
  minBidIncrement: number;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  guildId: string;
  sellerId: string;
  seller: {
    id: string;
    username: string;
    avatar?: string;
  };
  bidHistory: Bid[];
  isBlind?: boolean;
  createdAt: string;
  updatedAt: string;
}

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

export enum AuctionStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export interface Bid {
  id: string;
  auctionItemId: string;
  bidderId: string;
  bidder: {
    id: string;
    username: string;
    avatar?: string;
  };
  amount: number;
  timestamp: string;
  isWinning: boolean;
}

export interface PlaceBidRequest {
  auctionItemId: string;
  amount: number;
}

export interface CreateAuctionRequest {
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  startingBid: number;
  minBidIncrement: number;
  duration: number; // in hours
  guildId: string;
}
