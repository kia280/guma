// Auction types

import type { ItemCategory, ItemRarity, ItemSourceRef } from './item';

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
  sourceType?: 'backpack' | 'bank';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
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

export interface UpdateAuctionRequest {
  item?: {
    name: string;
    description: string;
    category: ItemCategory;
    rarity: ItemRarity;
  };
  startingBid?: number;
  minBidIncrement?: number;
  startTime?: string;
  endTime?: string;
}

export interface CreateAuctionRequest {
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  source?: ItemSourceRef;
  startingBid: number;
  minBidIncrement: number;
  duration: number; // in hours
  guildId: string;
}
