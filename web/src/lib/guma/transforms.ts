// Transforms proto-wire (snake_case, nested Item, etc.) → UI shapes used by components.
// Keep these pure — no I/O, no axios calls.

import { AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';
import type { AuctionItem, Bid } from '@/types/auction';
import type { BackpackItem } from '@/types/backpack';
import type { CheckinEntry, AttendanceMember, LootItem } from '@/types/checkin';
import { CheckinStatus } from '@/types/checkin';
import type { Lottery, LotteryTicket, LotteryWinner } from '@/types/lottery';
import type { Transaction, Wallet } from '@/types/wallet';
import type {
  GuildBank,
  BankContribution,
  FundRequest,
  GuildBankItem,
  ItemRequest,
  GuildContribution,
} from '@/types/guild-bank';
import type { GuildEvent } from '@/types/guild-events';
import type { User } from '@/types/user';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ts = (v: unknown): string => {
  if (!v) return new Date().toISOString();
  if (typeof v === 'string') return v;
  // protobuf Timestamp comes as { seconds, nanos } but grpc-gateway serializes
  // it as an RFC 3339 string by default. Fall back to Date if something else.
  try {
    return new Date(v as string | number | Date).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

// ─── User ───────────────────────────────────────────────────────────────────

type ProtoUser = {
  id?: string;
  username?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  bio?: string;
  guild_ids?: string[];
  current_guild_id?: string;
  balance?: number | string;
  created_at?: string;
  updated_at?: string;
};

export const toUser = (u: ProtoUser): User => ({
  id: u.id ?? '',
  username: u.username ?? '',
  displayName: u.display_name ?? '',
  email: u.email ?? '',
  avatarUrl: u.avatar_url ?? '',
  bio: u.bio ?? '',
  guildIds: u.guild_ids ?? [],
  currentGuildId: u.current_guild_id ?? '',
  balance: Number(u.balance ?? 0),
  createdAt: ts(u.created_at),
  updatedAt: ts(u.updated_at),
});

// ─── Auction ────────────────────────────────────────────────────────────────

type ProtoItem = {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  rarity?: string;
  image_url?: string;
};

type ProtoAuctionItem = {
  id: string;
  guild_id?: string;
  seller_id?: string;
  item?: ProtoItem;
  starting_bid?: number | string;
  current_bid?: number | string;
  current_bidder_id?: string;
  min_bid_increment?: number | string;
  start_time?: string;
  end_time?: string;
  status?: string;
  is_blind?: boolean;
  created_at?: string;
  updated_at?: string;
};

const toCategory = (s?: string): ItemCategory =>
  (s as ItemCategory) || ItemCategory.MISC;
const toRarity = (s?: string): ItemRarity => (s as ItemRarity) || ItemRarity.COMMON;
const toStatus = (s?: string): AuctionStatus =>
  (s?.toLowerCase() as AuctionStatus) || AuctionStatus.ACTIVE;

export const toAuctionItem = (raw: ProtoAuctionItem): AuctionItem => ({
  id: raw.id,
  name: raw.item?.name ?? '',
  description: raw.item?.description ?? '',
  category: toCategory(raw.item?.category),
  rarity: toRarity(raw.item?.rarity),
  imageUrl: raw.item?.image_url,
  startingBid: Number(raw.starting_bid ?? 0),
  currentBid: Number(raw.current_bid ?? 0),
  currentBidder: raw.current_bidder_id
    ? { id: raw.current_bidder_id, username: raw.current_bidder_id }
    : undefined,
  minBidIncrement: Number(raw.min_bid_increment ?? 0),
  startTime: ts(raw.start_time),
  endTime: ts(raw.end_time),
  status: toStatus(raw.status),
  isBlind: Boolean(raw.is_blind),
  guildId: raw.guild_id ?? '',
  sellerId: raw.seller_id ?? '',
  seller: { id: raw.seller_id ?? '', username: raw.seller_id ?? '' },
  bidHistory: [],
  createdAt: ts(raw.created_at),
  updatedAt: ts(raw.updated_at),
});

type ProtoBid = {
  id: string;
  auction_id?: string;
  bidder_id?: string;
  amount?: number | string;
  is_winning?: boolean;
  placed_at?: string;
  bidder_username?: string;
  bidder_avatar_url?: string;
};

export const toBid = (raw: ProtoBid): Bid => {
  const username = raw.bidder_username || raw.bidder_id || 'Unknown';
  return {
    id: raw.id,
    auctionItemId: raw.auction_id ?? '',
    bidderId: raw.bidder_id ?? '',
    bidder: {
      id: raw.bidder_id ?? '',
      username,
      avatar: raw.bidder_avatar_url || undefined,
    },
    amount: Number(raw.amount ?? 0),
    timestamp: ts(raw.placed_at),
    isWinning: Boolean(raw.is_winning),
  };
};

// ─── Check-in ───────────────────────────────────────────────────────────────

type ProtoCheckIn = {
  id: string;
  guild_id?: string;
  title?: string;
  description?: string;
  datetime?: string;
  expire_time?: string;
  image_url?: string;
  loot_list?: ProtoItem[];
  attendance_count?: number;
  is_expired?: boolean;
};

export const toCheckin = (raw: ProtoCheckIn, attendees: AttendanceMember[] = []): CheckinEntry => {
  const loot: LootItem[] = (raw.loot_list ?? []).map((i, idx) => ({
    id: i.id ?? `l-${idx}`,
    name: i.name ?? '',
  }));
  const status: CheckinStatus = raw.is_expired
    ? CheckinStatus.FINISHED
    : CheckinStatus.OPEN;
  return {
    id: raw.id,
    status,
    date: raw.datetime ?? '',
    description: raw.title ?? '',
    expireTime: raw.expire_time,
    attendanceList: attendees,
    lootList: loot,
    imageUrl: raw.image_url,
  };
};

type ProtoAttendee = {
  id: string;
  user_id?: string;
  display_name?: string;
  avatar_url?: string;
  attended_at?: string;
};

export const toAttendee = (raw: ProtoAttendee): AttendanceMember => ({
  id: raw.id,
  username: raw.display_name || raw.user_id || 'Unknown',
  checkedInAt: ts(raw.attended_at),
});

// ─── Lottery ────────────────────────────────────────────────────────────────

type ProtoPrize = { rank?: number; description?: string; amount?: number | string };

type ProtoLottery = {
  id: string;
  title?: string;
  ticket_price?: number | string;
  tickets_sold?: number;
  max_tickets?: number;
  status?: string;
  draw_date?: string;
  prizes?: ProtoPrize[];
  winners?: ProtoLotteryWinner[];
};

type ProtoLotteryWinner = {
  id?: string;
  username?: string;
  rank?: number;
  prize_amount?: number | string;
  prize_description?: string;
};

export const toLottery = (raw: ProtoLottery): Lottery => {
  const prizePool = (raw.prizes ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const winners = raw.winners?.length
    ? raw.winners.map(toLotteryWinner)
    : undefined;
  return {
    id: raw.id,
    title: raw.title ?? '',
    prizePool,
    ticketPrice: Number(raw.ticket_price ?? 0),
    drawDate: raw.draw_date ?? '',
    ticketsSold: raw.tickets_sold ?? 0,
    maxTickets: raw.max_tickets ?? 0,
    status: (raw.status?.toLowerCase() as Lottery['status']) || 'active',
    winners,
  };
};

export const toLotteryWinner = (raw: ProtoLotteryWinner): LotteryWinner => {
  const prize = raw.prize_description
    || (raw.prize_amount ? `$${Number(raw.prize_amount).toLocaleString()}` : '');
  return {
    id: raw.id ?? '',
    username: raw.username ?? '',
    prize,
  };
};

type ProtoTicket = {
  id: string;
  lottery_id?: string;
  user_id?: string;
  ticket_number?: string;
  purchased_at?: string;
};

export const toLotteryTicket = (raw: ProtoTicket): LotteryTicket => ({
  id: raw.id,
  lotteryId: raw.lottery_id ?? '',
  userId: raw.user_id ?? '',
  ticketNumber: raw.ticket_number ?? '',
  purchasedAt: ts(raw.purchased_at),
});

// ─── Wallet ─────────────────────────────────────────────────────────────────

type ProtoTransaction = {
  id: string;
  type?: string;
  amount?: number | string;
  recipient?: string;
  status?: string;
  description?: string;
  created_at?: string;
};

type ProtoWallet = {
  user_id?: string;
  guild_id?: string;
  balance?: number | string;
  currency?: string;
  created_at?: string;
  updated_at?: string;
};

export const toWallet = (w: ProtoWallet): Wallet => ({
  id: `${w.user_id ?? ''}:${w.guild_id ?? ''}`,
  userId: w.user_id ?? '',
  guildId: w.guild_id ?? '',
  balance: Number(w.balance ?? 0),
  currency: w.currency ?? 'gold',
  createdAt: ts(w.created_at),
  updatedAt: ts(w.updated_at),
});

export const toTransaction = (raw: ProtoTransaction): Transaction => {
  const rawType = (raw.type || '').toLowerCase();
  const type: Transaction['type'] =
    rawType === 'deposit' || rawType === 'transfer' || rawType === 'withdraw'
      ? (rawType as Transaction['type'])
      : 'deposit';
  return {
    id: raw.id,
    type,
    amount: Number(raw.amount ?? 0),
    recipient: raw.recipient,
    date: ts(raw.created_at).slice(0, 10),
    status: (raw.status?.toLowerCase() as Transaction['status']) || 'completed',
    description: raw.description,
  };
};

type ProtoBackpackItem = {
  id: string;
  item?: ProtoItem;
  acquired_from?: string;
  acquired_at?: string;
  owner_id?: string;
  guild_id?: string;
  note?: string;
};

export const toBackpackItem = (raw: ProtoBackpackItem): BackpackItem => ({
  id: raw.id,
  item: {
    id: raw.item?.id ?? '',
    name: raw.item?.name ?? '',
    description: raw.item?.description ?? '',
    category: toCategory(raw.item?.category),
    rarity: toRarity(raw.item?.rarity),
    imageUrl: raw.item?.image_url,
  },
  acquiredFrom: (raw.acquired_from as BackpackItem['acquiredFrom']) || 'admin',
  acquiredAt: ts(raw.acquired_at),
  ownerId: raw.owner_id ?? '',
  guildId: raw.guild_id ?? '',
  note: raw.note,
});

// ─── Guild Bank ─────────────────────────────────────────────────────────────

type ProtoGuildBank = {
  id: string;
  guild_id?: string;
  balance?: number | string;
  currency?: string;
  goal?: number | string;
  updated_at?: string;
};

export const toGuildBank = (raw: ProtoGuildBank): GuildBank => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  balance: Number(raw.balance ?? 0),
  currency: raw.currency ?? 'gold',
  goal: Number(raw.goal ?? 0),
  updatedAt: ts(raw.updated_at),
});

type ProtoBankContribution = {
  id: string;
  guild_id?: string;
  user_id?: string;
  username?: string;
  amount?: number | string;
  note?: string;
  created_at?: string;
};

export const toBankContribution = (raw: ProtoBankContribution): BankContribution => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  userId: raw.user_id ?? '',
  username: raw.username ?? '',
  amount: Number(raw.amount ?? 0),
  note: raw.note,
  createdAt: ts(raw.created_at),
});

type ProtoFundRequest = {
  id: string;
  guild_id?: string;
  requester_id?: string;
  requester_name?: string;
  amount?: number | string;
  reason?: string;
  status?: string;
  created_at?: string;
};

export const toFundRequest = (raw: ProtoFundRequest): FundRequest => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  requesterId: raw.requester_id ?? '',
  requesterName: raw.requester_name ?? '',
  amount: Number(raw.amount ?? 0),
  reason: raw.reason ?? '',
  status: (raw.status?.toLowerCase() as FundRequest['status']) || 'pending',
  createdAt: ts(raw.created_at),
});

type ProtoBankItem = {
  id: string;
  donor_name?: string;
  item?: ProtoItem;
  quantity?: number;
  donated_at?: string;
};

export const toGuildBankItem = (raw: ProtoBankItem): GuildBankItem => ({
  id: raw.id,
  name: raw.item?.name ?? '',
  description: raw.item?.description ?? '',
  category: toCategory(raw.item?.category),
  rarity: toRarity(raw.item?.rarity),
  donatedBy: raw.donor_name ?? '',
  donatedAt: ts(raw.donated_at),
  quantity: raw.quantity ?? 1,
});

type ProtoItemRequest = {
  id: string;
  guild_id?: string;
  bank_item_id?: string;
  requester_id?: string;
  requester_name?: string;
  reason?: string;
  status?: string;
  created_at?: string;
};

export const toItemRequest = (raw: ProtoItemRequest): ItemRequest => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  bankItemId: raw.bank_item_id ?? '',
  requesterId: raw.requester_id ?? '',
  requesterName: raw.requester_name ?? '',
  reason: raw.reason ?? '',
  status: (raw.status?.toLowerCase() as ItemRequest['status']) || 'pending',
  createdAt: ts(raw.created_at),
});

/** Merge the backend's separate history streams into the unified UI shape. */
export const toGuildContributions = (
  contributions: BankContribution[],
  fundRequests: FundRequest[],
): GuildContribution[] => {
  const c: GuildContribution[] = contributions.map(b => ({
    id: `c-${b.id}`,
    type: 'contribute',
    amount: b.amount,
    member: b.username,
    date: b.createdAt.slice(0, 10),
    status: 'completed',
    note: b.note,
  }));
  const r: GuildContribution[] = fundRequests.map(f => ({
    id: `r-${f.id}`,
    type: 'request',
    amount: f.amount,
    member: f.requesterName,
    date: f.createdAt.slice(0, 10),
    status: f.status === 'pending' ? 'pending' : f.status,
    note: f.reason,
  }));
  return [...c, ...r].sort((a, b) => (a.date < b.date ? 1 : -1));
};

// ─── Guild Event (calendar) ─────────────────────────────────────────────────

type ProtoGuildEvent = {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  is_all_day?: boolean;
  location?: string;
  participants?: string[];
  is_recurring?: boolean;
  recurring_pattern?: unknown;
  priority?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
};

export const toGuildEvent = (raw: ProtoGuildEvent): GuildEvent => ({
  id: raw.id,
  title: raw.title ?? '',
  description: raw.description,
  type: (raw.type as GuildEvent['type']) || 'other',
  startDate: ts(raw.start_date),
  endDate: raw.end_date,
  isAllDay: Boolean(raw.is_all_day),
  location: raw.location,
  participants: raw.participants,
  isRecurring: Boolean(raw.is_recurring),
  recurringPattern: raw.recurring_pattern as GuildEvent['recurringPattern'],
  priority: (raw.priority as GuildEvent['priority']) || 'medium',
  createdBy: raw.created_by ?? '',
  createdAt: ts(raw.created_at),
  updatedAt: ts(raw.updated_at),
});
