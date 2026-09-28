// Transforms proto-wire (snake_case, nested Item, etc.) → UI shapes used by components.
// Keep these pure — no I/O, no axios calls.

import type { AdminAnnouncement, AdminGuildStats } from '@/types/admin';
import { AuctionStatus } from '@/types/auction';
import type { AuctionItem, Bid } from '@/types/auction';
import type { BackpackItem, BackpackItemSource } from '@/types/backpack';
import type {
  CheckinEntry,
  CheckinGoldDistribution,
  CheckinGoldPayout,
  CheckinGoldPot,
  CheckinGoldSummary,
  CheckinTemplate,
  AttendanceMember,
  ItemTemplate,
  LootItem,
} from '@/types/checkin';
import { CheckinStatus } from '@/types/checkin';
import type { Announcement } from '@/types/dashboard';
import type { Guild } from '@/types/guild';
import type {
  GuildBank,
  BankContribution,
  BankContributionKind,
  FundRequest,
  GuildBankItem,
  ItemRequest,
  GuildContribution,
} from '@/types/guild-bank';
import type { GuildEvent } from '@/types/guild-events';
import { ItemCategory, ItemRarity, type ItemHistoryEvent, type ItemHistoryKind, type ItemLock } from '@/types/item';
import type { Lottery, LotteryTicket, LotteryWinner } from '@/types/lottery';
import type { GuildNotification, NotificationPage, NotificationParams } from '@/types/notification';
import type { UserPreferences } from '@/types/preference';
import type { LinkedAccount, MockUser, User } from '@/types/user';
import type { Transaction, Wallet } from '@/types/wallet';
import { fromMinorUnits } from './money';

// ─── Helpers ────────────────────────────────────────────────────────────────

type ProtoItemLock = { type?: string; id?: string };

const toItemLock = (raw: ProtoItemLock | undefined): ItemLock | undefined =>
  raw?.id && (raw.type === 'auction' || raw.type === 'lottery') ? { type: raw.type, id: raw.id } : undefined;

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

// ─── Guild ──────────────────────────────────────────────────────────────────

type ProtoGuild = {
  id?: string;
  name?: string;
  description?: string;
  owner_id?: string;
  member_count?: number;
  icon_url?: string;
  banner_url?: string;
  settings?: {
    timezone?: string;
    language?: string;
    public?: boolean;
    custom_settings?: Record<string, string>;
  };
  created_at?: string;
  updated_at?: string;
};

const resolveAssetUrl = (url: string | undefined, apiBase: string): string | undefined => {
  if (!url) return undefined;
  return url.startsWith('/') ? `${apiBase}${url}` : url;
};

export const toGuild = (g: ProtoGuild, apiBase = ''): Guild => {
  const custom = g.settings?.custom_settings ?? {};
  const flag = (key: string) => custom[key] === 'true';
  return {
    id: g.id ?? '',
    name: g.name ?? '',
    description: g.description || undefined,
    icon: resolveAssetUrl(g.icon_url, apiBase),
    banner: resolveAssetUrl(g.banner_url, apiBase),
    ownerId: g.owner_id ?? '',
    memberCount: g.member_count ?? 0,
    settings: {
      timezone: g.settings?.timezone ?? 'UTC',
      language: g.settings?.language ?? 'en',
      isPublic: g.settings?.public ?? false,
      currency: custom.currency ?? '',
      features: {
        economy: flag('economy'),
        events: flag('events'),
        raids: flag('raids'),
        voting: flag('voting'),
      },
    },
    createdAt: ts(g.created_at),
    updatedAt: ts(g.updated_at),
  };
};

type ProtoGuildStats = {
  member_count?: number;
  bank_balance?: number | string;
  bank_currency?: string;
  active_event_count?: number;
  bank_item_count?: number;
};

export const toAdminGuildStats = (raw: ProtoGuildStats | undefined): AdminGuildStats => ({
  memberCount: raw?.member_count ?? 0,
  bankBalance: fromMinorUnits(raw?.bank_balance),
  bankCurrency: raw?.bank_currency ?? 'gold',
  activeEventCount: raw?.active_event_count ?? 0,
  bankItemCount: raw?.bank_item_count ?? 0,
});

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
  email_verified?: boolean;
  discord?: ProtoLinkedAccount;
  guild_role?: string;
};

type ProtoLinkedAccount = {
  provider?: string;
  subject?: string;
  username?: string;
};

const toLinkedAccount = (a: ProtoLinkedAccount): LinkedAccount => ({
  provider: a.provider ?? '',
  subject: a.subject ?? '',
  username: a.username ?? '',
});

export const toUser = (u: ProtoUser): User => ({
  id: u.id ?? '',
  displayName: u.display_name ?? '',
  email: u.email ?? '',
  avatarUrl: u.avatar_url ?? '',
  bio: u.bio ?? '',
  guildIds: u.guild_ids ?? [],
  currentGuildId: u.current_guild_id ?? '',
  balance: fromMinorUnits(u.balance),
  createdAt: ts(u.created_at),
  updatedAt: ts(u.updated_at),
  emailVerified: typeof u.email_verified === 'boolean' ? u.email_verified : undefined,
  discord: u.discord ? toLinkedAccount(u.discord) : undefined,
  guildRole: u.guild_role ?? '',
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
  current_bidder_name?: string;
  current_bidder_avatar_url?: string;
  seller_name?: string;
  seller_avatar_url?: string;
  min_bid_increment?: number | string;
  start_time?: string;
  end_time?: string;
  status?: string;
  is_blind?: boolean;
  source_type?: string;
  created_at?: string;
  updated_at?: string;
  cancelled_at?: string;
};

const toSourceType = (s?: string): AuctionItem['sourceType'] =>
  s === 'backpack' || s === 'bank' ? s : undefined;

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
  startingBid: fromMinorUnits(raw.starting_bid),
  currentBid: fromMinorUnits(raw.current_bid),
  currentBidder: raw.current_bidder_id
    ? {
        id: raw.current_bidder_id,
        username: raw.current_bidder_name ?? '',
        avatar: raw.current_bidder_avatar_url || undefined,
      }
    : undefined,
  minBidIncrement: fromMinorUnits(raw.min_bid_increment),
  startTime: ts(raw.start_time),
  endTime: ts(raw.end_time),
  status: toStatus(raw.status),
  isBlind: Boolean(raw.is_blind),
  sourceType: toSourceType(raw.source_type),
  guildId: raw.guild_id ?? '',
  sellerId: raw.seller_id ?? '',
  seller: {
    id: raw.seller_id ?? '',
    username: raw.seller_name ?? '',
    avatar: raw.seller_avatar_url || undefined,
  },
  bidHistory: [],
  createdAt: ts(raw.created_at),
  updatedAt: ts(raw.updated_at),
  ...(raw.cancelled_at ? { cancelledAt: ts(raw.cancelled_at) } : {}),
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

export const toBid = (raw: ProtoBid): Bid => ({
  id: raw.id,
  auctionItemId: raw.auction_id ?? '',
  bidderId: raw.bidder_id ?? '',
  bidder: {
    id: raw.bidder_id ?? '',
    username: raw.bidder_username ?? '',
    avatar: raw.bidder_avatar_url || undefined,
  },
  amount: fromMinorUnits(raw.amount),
  timestamp: ts(raw.placed_at),
  isWinning: Boolean(raw.is_winning),
});

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
  loot?: ProtoCheckInLootEntry[];
  gold_pot?: ProtoCheckInGoldPot;
  attendance_count?: number;
  is_expired?: boolean;
  is_cancelled?: boolean;
};

type ProtoCheckInLootEntry = {
  kind?: string;
  item?: ProtoItem;
  amount?: number | string;
};

type ProtoCheckInGoldPot = {
  total?: number | string;
  distributed?: number | string;
  retracted?: number | string;
  remaining?: number | string;
};

type ProtoCheckInGoldPayout = {
  user_id?: string;
  amount?: number | string;
};

const toCheckinGoldPot = (raw: ProtoCheckInGoldPot): CheckinGoldPot => ({
  total: fromMinorUnits(raw.total),
  distributed: fromMinorUnits(raw.distributed),
  retracted: fromMinorUnits(raw.retracted),
  remaining: fromMinorUnits(raw.remaining),
});

const toCheckinGoldPayout = (raw: ProtoCheckInGoldPayout): CheckinGoldPayout => ({
  userId: raw.user_id ?? '',
  amount: fromMinorUnits(raw.amount),
});

export const toCheckinGoldSummary = (raw: {
  pot?: ProtoCheckInGoldPot;
  recipients?: ProtoCheckInGoldPayout[];
}): CheckinGoldSummary => ({
  pot: raw.pot ? toCheckinGoldPot(raw.pot) : undefined,
  recipients: (raw.recipients ?? []).map(toCheckinGoldPayout),
});

export const toCheckinGoldDistribution = (raw: {
  pot?: ProtoCheckInGoldPot;
  payouts?: ProtoCheckInGoldPayout[];
  replayed?: boolean;
}): CheckinGoldDistribution => ({
  pot: toCheckinGoldPot(raw.pot ?? {}),
  payouts: (raw.payouts ?? []).map(toCheckinGoldPayout),
  replayed: Boolean(raw.replayed),
});

const toCheckinGoldLoot = (raw: ProtoCheckIn): CheckinGoldPot | undefined => {
  if (raw.gold_pot) return toCheckinGoldPot(raw.gold_pot);
  const gold = raw.loot?.find(entry => entry.kind === 'gold');
  if (!gold) return undefined;
  const total = fromMinorUnits(gold.amount);
  return { total, distributed: 0, retracted: 0, remaining: total };
};

export const toCheckin = (raw: ProtoCheckIn, attendees: AttendanceMember[] = []): CheckinEntry => {
  const items = raw.loot ? raw.loot.filter(entry => entry.kind !== 'gold').map(entry => entry.item ?? {}) : raw.loot_list ?? [];
  const loot: LootItem[] = items.map((i, idx) => ({
    id: i.id ?? `l-${idx}`,
    name: i.name ?? '',
  }));
  const status: CheckinStatus = raw.is_cancelled
    ? CheckinStatus.CANCELLED
    : raw.is_expired
      ? CheckinStatus.FINISHED
      : CheckinStatus.OPEN;
  return {
    id: raw.id,
    status,
    date: raw.datetime ?? '',
    title: raw.title ?? '',
    description: raw.description || undefined,
    expireTime: raw.expire_time,
    attendanceCount: raw.attendance_count ?? attendees.length,
    attendanceList: attendees,
    lootList: loot,
    goldLoot: toCheckinGoldLoot(raw),
    imageUrl: raw.image_url || undefined,
  };
};

type ProtoCheckInTemplate = {
  id: string;
  name?: string;
  title?: string;
  items?: ProtoItem[];
};

export const toItemTemplate = (raw: ProtoItem): ItemTemplate => ({
  id: raw.id ?? '',
  name: raw.name ?? '',
  description: raw.description ?? '',
  category: toCategory(raw.category),
  rarity: toRarity(raw.rarity),
});

export const toCheckinTemplate = (raw: ProtoCheckInTemplate): CheckinTemplate => ({
  id: raw.id,
  name: raw.name ?? '',
  title: raw.title ?? '',
  items: (raw.items ?? []).map(toItemTemplate),
});

type ProtoMember = {
  id: string;
  user_id?: string;
  display_name?: string;
  discord_username?: string;
  avatar_url?: string;
  role?: string;
  last_active?: string;
};

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

export const toMember = (raw: ProtoMember): MockUser => {
  const lastActive = ts(raw.last_active);
  return {
    id: raw.user_id || raw.id,
    username: raw.display_name ?? '',
    discordUsername: raw.discord_username || undefined,
    role: raw.role,
    status: Date.now() - new Date(lastActive).getTime() < ONLINE_WINDOW_MS ? 'online' : 'offline',
    lastActive,
    avatar: raw.avatar_url || undefined,
  };
};

type ProtoAttendee = {
  id: string;
  user_id?: string;
  display_name?: string;
  avatar_url?: string;
  attended_at?: string;
  notes?: string;
};

export const toAttendee = (raw: ProtoAttendee): AttendanceMember => ({
  id: raw.id,
  userId: raw.user_id,
  username: raw.display_name ?? '',
  avatar: raw.avatar_url || undefined,
  checkedInAt: ts(raw.attended_at),
  ...(raw.notes ? { notes: raw.notes } : {}),
});

// ─── Lottery ────────────────────────────────────────────────────────────────

type ProtoPrize = { rank?: number; description?: string; amount?: number | string; item?: ProtoItem };

type ProtoLottery = {
  id: string;
  title?: string;
  description?: string;
  cancelled_at?: string;
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
  user_id?: string;
  username?: string;
  avatar_url?: string;
  rank?: number;
  prize_amount?: number | string;
  prize_description?: string;
};

export const toLottery = (raw: ProtoLottery): Lottery => {
  const prizePool = fromMinorUnits((raw.prizes ?? []).reduce((sum, p) => sum + Number(p.amount ?? 0), 0));
  const winners = raw.winners?.length
    ? raw.winners.map(toLotteryWinner)
    : undefined;
  return {
    id: raw.id,
    title: raw.title ?? '',
    description: raw.description ?? '',
    prizePool,
    prizes: (raw.prizes ?? []).map((prize, index) => ({
      rank: prize.rank ?? index + 1,
      description: prize.description ?? '',
      amount: prize.amount ? fromMinorUnits(prize.amount) : undefined,
      itemName: prize.item?.name || undefined,
    })),
    ticketPrice: fromMinorUnits(raw.ticket_price),
    drawDate: raw.draw_date ?? '',
    ticketsSold: raw.tickets_sold ?? 0,
    maxTickets: raw.max_tickets ?? 0,
    status: (raw.status?.toLowerCase() as Lottery['status']) || 'active',
    ...(raw.cancelled_at ? { cancelledAt: raw.cancelled_at } : {}),
    winners,
  };
};

export const toLotteryWinner = (raw: ProtoLotteryWinner): LotteryWinner => ({
  id: raw.id ?? '',
  userId: raw.user_id || undefined,
  username: raw.username ?? '',
  avatar: raw.avatar_url || undefined,
  prize: raw.prize_description ?? '',
  prizeAmount: raw.prize_amount ? fromMinorUnits(raw.prize_amount) : undefined,
});

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
  reference_id?: string;
  reference_type?: string;
};

type ProtoLockedBid = {
  auction_id?: string;
  item_name?: string;
  amount?: number | string;
  end_time?: string;
};

type ProtoWallet = {
  user_id?: string;
  guild_id?: string;
  balance?: number | string;
  currency?: string;
  created_at?: string;
  updated_at?: string;
  locked_in_bids?: number | string;
  locked_bids?: ProtoLockedBid[];
};

export const toWallet = (w: ProtoWallet): Wallet => ({
  id: `${w.user_id ?? ''}:${w.guild_id ?? ''}`,
  userId: w.user_id ?? '',
  guildId: w.guild_id ?? '',
  balance: fromMinorUnits(w.balance),
  currency: w.currency ?? 'gold',
  createdAt: ts(w.created_at),
  updatedAt: ts(w.updated_at),
  lockedInBids: fromMinorUnits(w.locked_in_bids),
  lockedBids: (w.locked_bids ?? []).map(b => ({
    auctionId: b.auction_id ?? '',
    itemName: b.item_name ?? '',
    amount: fromMinorUnits(b.amount),
    endTime: ts(b.end_time),
  })),
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
    kind: raw.type?.toUpperCase(),
    amount: fromMinorUnits(raw.amount),
    recipient: raw.recipient,
    date: ts(raw.created_at).slice(0, 10),
    status: (raw.status?.toLowerCase() as Transaction['status']) || 'completed',
    description: raw.description,
    referenceType: raw.reference_type || undefined,
    referenceId: raw.reference_id || undefined,
  };
};

type ProtoBackpackItem = {
  id: string;
  item?: ProtoItem;
  source?: string;
  source_id?: string;
  source_label?: string;
  acquired_at?: string;
  owner_id?: string;
  guild_id?: string;
  note?: string;
  delivery_requested_at?: string;
  owner_name?: string;
  lock?: ProtoItemLock;
};

const BACKPACK_SOURCES: Record<string, BackpackItemSource> = {
  auction: 'auction',
  lottery: 'lottery',
  transfer: 'transfer',
  checkin: 'checkin',
  bank_item_request: 'bank',
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
  acquiredFrom: BACKPACK_SOURCES[raw.source ?? ''] ?? 'admin',
  sourceId: raw.source_id || undefined,
  sourceLabel: raw.source_label || undefined,
  acquiredAt: ts(raw.acquired_at),
  ownerId: raw.owner_id ?? '',
  guildId: raw.guild_id ?? '',
  note: raw.note,
  deliveryRequestedAt: raw.delivery_requested_at || undefined,
  ownerName: raw.owner_name || undefined,
  lock: toItemLock(raw.lock),
});

// ─── Guild Bank ─────────────────────────────────────────────────────────────

type ProtoGuildBank = {
  id: string;
  guild_id?: string;
  balance?: number | string;
  currency?: string;
  updated_at?: string;
};

export const toGuildBank = (raw: ProtoGuildBank): GuildBank => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  balance: fromMinorUnits(raw.balance),
  currency: raw.currency ?? 'gold',
  updatedAt: ts(raw.updated_at),
});

type ProtoBankContribution = {
  id: string;
  guild_id?: string;
  user_id?: string;
  username?: string;
  avatar_url?: string;
  amount?: number | string;
  note?: string;
  created_at?: string;
  kind?: string;
  items?: ProtoItem[];
  checkin_id?: string;
  reference_type?: string;
  reference_id?: string;
};

const BANK_CONTRIBUTION_KINDS: readonly BankContributionKind[] = [
  'gold',
  'checkin_loot',
  'auction_proceeds',
  'lottery_revenue',
  'checkin_gold_payout',
  'checkin_gold_retracted',
];

const contributionReferenceHref = (b: BankContribution): string | undefined => {
  if (!b.referenceId) return undefined;
  if (b.referenceType === 'auction') return `/dashboard/auction/${b.referenceId}`;
  if (b.referenceType === 'lottery') return `/dashboard/lottery/${b.referenceId}`;
  return undefined;
};

const checkinHref = (b: BankContribution): string | undefined =>
  b.checkinId ? `/dashboard/attendance/${b.checkinId}` : undefined;

const contributionType = (kind: BankContributionKind): GuildContribution['type'] =>
  kind === 'gold' ? 'contribute' : kind;

const toContributionKind = (kind: string | undefined): BankContributionKind =>
  BANK_CONTRIBUTION_KINDS.find(k => k === kind) ?? 'gold';

export const toBankContribution = (raw: ProtoBankContribution): BankContribution => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  userId: raw.user_id ?? '',
  username: raw.username ?? '',
  avatarUrl: raw.avatar_url || undefined,
  amount: fromMinorUnits(raw.amount),
  note: raw.note,
  createdAt: ts(raw.created_at),
  kind: toContributionKind(raw.kind),
  itemNames: (raw.items ?? []).map(i => i.name ?? '').filter(Boolean),
  checkinId: raw.checkin_id || undefined,
  referenceType: raw.reference_type || undefined,
  referenceId: raw.reference_id || undefined,
});

type ProtoFundRequest = {
  id: string;
  guild_id?: string;
  requester_id?: string;
  requester_name?: string;
  requester_avatar_url?: string;
  amount?: number | string;
  reason?: string;
  status?: string;
  review_note?: string;
  created_at?: string;
  reviewed_at?: string;
};

export const toFundRequest = (raw: ProtoFundRequest): FundRequest => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  requesterId: raw.requester_id ?? '',
  requesterName: raw.requester_name ?? '',
  requesterAvatarUrl: raw.requester_avatar_url || undefined,
  amount: fromMinorUnits(raw.amount),
  reason: raw.reason ?? '',
  status: (raw.status?.toLowerCase() as FundRequest['status']) || 'pending',
  reviewNote: raw.review_note || undefined,
  createdAt: ts(raw.created_at),
  reviewedAt: raw.reviewed_at ? ts(raw.reviewed_at) : undefined,
});

type ProtoBankItem = {
  id: string;
  donor_name?: string;
  item?: ProtoItem;
  quantity?: number;
  donated_at?: string;
  checkin_id?: string;
  checkin_title?: string;
  pending_request_count?: number;
  requested_by_me?: boolean;
  lock?: ProtoItemLock;
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
  checkinId: raw.checkin_id || undefined,
  checkinTitle: raw.checkin_title || undefined,
  pendingRequestCount: raw.pending_request_count ?? 0,
  requestedByMe: raw.requested_by_me ?? false,
  lock: toItemLock(raw.lock),
});

type ProtoItemRequest = {
  id: string;
  guild_id?: string;
  bank_item_id?: string;
  requester_id?: string;
  requester_name?: string;
  requester_avatar_url?: string;
  reason?: string;
  status?: string;
  item?: ProtoItem;
  review_note?: string;
  created_at?: string;
  reviewed_at?: string;
};

export const toItemRequest = (raw: ProtoItemRequest): ItemRequest => ({
  id: raw.id,
  guildId: raw.guild_id ?? '',
  bankItemId: raw.bank_item_id ?? '',
  requesterId: raw.requester_id ?? '',
  requesterName: raw.requester_name ?? '',
  requesterAvatarUrl: raw.requester_avatar_url || undefined,
  reason: raw.reason ?? '',
  status: (raw.status?.toLowerCase() as ItemRequest['status']) || 'pending',
  itemName: raw.item?.name ?? '',
  itemCategory: toCategory(raw.item?.category),
  itemRarity: toRarity(raw.item?.rarity),
  reviewNote: raw.review_note || undefined,
  createdAt: ts(raw.created_at),
  reviewedAt: raw.reviewed_at ? ts(raw.reviewed_at) : undefined,
});

/** Merge the backend's separate history streams into the unified UI shape. */
export const toGuildContributions = (
  contributions: BankContribution[],
  fundRequests: FundRequest[],
  itemRequests: ItemRequest[] = [],
): GuildContribution[] => {
  const c: GuildContribution[] = contributions.map(b =>
    b.kind === 'checkin_loot'
      ? {
          id: `c-${b.id}`,
          type: 'checkin_loot',
          itemName: b.itemNames.join(', ') || undefined,
          amount: b.amount > 0 ? b.amount : undefined,
          member: b.username,
          memberAvatar: b.avatarUrl,
          date: b.createdAt.slice(0, 10),
          status: 'completed',
          note: b.note,
          checkinId: b.checkinId,
          href: checkinHref(b),
        }
      : {
          id: `c-${b.id}`,
          type: contributionType(b.kind),
          amount: Math.abs(b.amount),
          checkinId: b.checkinId,
          href: b.kind === 'checkin_gold_payout' || b.kind === 'checkin_gold_retracted' ? checkinHref(b) : contributionReferenceHref(b),
          member: b.username,
          memberAvatar: b.avatarUrl,
          date: b.createdAt.slice(0, 10),
          status: 'completed',
          note: b.note,
        },
  );
  const r: GuildContribution[] = fundRequests.map(f => ({
    id: `r-${f.id}`,
    type: 'request',
    amount: f.amount,
    member: f.requesterName,
    memberAvatar: f.requesterAvatarUrl,
    date: f.createdAt.slice(0, 10),
    status: f.status === 'pending' ? 'pending' : f.status,
    note: f.reason,
  }));
  const i: GuildContribution[] = itemRequests.map(req => ({
    id: `i-${req.id}`,
    type: 'item_distribute',
    itemName: req.itemName,
    member: req.requesterName,
    memberAvatar: req.requesterAvatarUrl,
    date: req.createdAt.slice(0, 10),
    status: req.status,
    note: req.reason,
  }));
  return [...c, ...r, ...i].sort((a, b) => (a.date < b.date ? 1 : -1));
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
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
};

type ProtoRecurringPattern = {
  type?: string;
  interval?: number;
  days_of_week?: number[];
  daysOfWeek?: number[];
  end_date?: string;
  endDate?: string;
  occurrences?: number;
  custom_hours?: number;
  custom_minutes?: number;
  customInterval?: { hours?: number; minutes?: number; seconds?: number };
};

const toRecurringPattern = (raw: unknown): GuildEvent['recurringPattern'] => {
  if (!raw || typeof raw !== 'object') return undefined;
  const p = raw as ProtoRecurringPattern;
  const custom = p.customInterval;
  const customHours = custom?.hours ?? p.custom_hours ?? 0;
  const customMinutes = custom?.minutes ?? p.custom_minutes ?? 0;
  const customSeconds = custom?.seconds ?? 0;
  const hasCustomInterval = custom !== undefined || p.custom_hours !== undefined || p.custom_minutes !== undefined;
  return {
    type: (p.type as NonNullable<GuildEvent['recurringPattern']>['type']) || 'custom',
    interval: Number(p.interval ?? 0),
    customInterval: hasCustomInterval
      ? { hours: Number(customHours), minutes: Number(customMinutes), seconds: Number(customSeconds) }
      : undefined,
    daysOfWeek: p.daysOfWeek ?? p.days_of_week,
    endDate: p.endDate ?? p.end_date ?? undefined,
    occurrences: p.occurrences,
  };
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
  recurringPattern: toRecurringPattern(raw.recurring_pattern),
  priority: (raw.priority as GuildEvent['priority']) || 'medium',
  createdBy: raw.created_by ?? '',
  createdByName: raw.created_by_name || undefined,
  createdAt: ts(raw.created_at),
  updatedAt: ts(raw.updated_at),
});

// ─── Notification ───────────────────────────────────────────────────────────

type ProtoNotification = {
  id: string;
  title?: string;
  message?: string;
  type?: string;
  read?: boolean;
  created_at?: string;
  action_url?: string;
  params?: Record<string, unknown>;
};

const toNotificationParams = (raw: Record<string, unknown> | undefined): NotificationParams => {
  const params: NotificationParams = {};
  Object.entries(raw ?? {}).forEach(([key, value]) => {
    if (typeof value === 'number' || typeof value === 'string') params[key] = value;
    else if (typeof value === 'boolean') params[key] = String(value);
  });
  return params;
};

const toInternalHref = (url: string | undefined): string | undefined =>
  url && url.startsWith('/') && !url.startsWith('//') ? url : undefined;

export const toNotification = (raw: ProtoNotification): GuildNotification => ({
  id: raw.id,
  type: raw.type ?? '',
  title: raw.title ?? '',
  message: raw.message ?? '',
  params: toNotificationParams(raw.params),
  createdAt: ts(raw.created_at),
  isRead: raw.read ?? false,
  href: toInternalHref(raw.action_url),
});

type ProtoNotificationPage = {
  notifications?: ProtoNotification[];
  next_page_token?: string;
  total_count?: number;
  unread_count?: number;
};

export const toNotificationPage = (raw: ProtoNotificationPage): NotificationPage => ({
  notifications: (raw.notifications ?? []).map(toNotification),
  nextPageToken: raw.next_page_token || undefined,
  totalCount: Number(raw.total_count ?? 0),
  unreadCount: Number(raw.unread_count ?? 0),
});

// ─── Announcement ───────────────────────────────────────────────────────────

type ProtoAnnouncement = {
  id: string;
  author_name?: string;
  title?: string;
  content?: string;
  pinned?: boolean;
  status?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
};

export const toAdminAnnouncement = (raw: ProtoAnnouncement): AdminAnnouncement => ({
  id: raw.id,
  title: raw.title ?? '',
  content: raw.content ?? '',
  pinned: raw.pinned ?? false,
  status: raw.status === 'published' ? 'published' : 'draft',
  author: raw.author_name ?? '',
  createdAt: ts(raw.created_at),
  updatedAt: ts(raw.updated_at),
  publishedAt: raw.published_at ? ts(raw.published_at) : undefined,
});

const formatAnnouncementDate = (iso: string): string => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())}`;
};

export const toAnnouncement = (raw: ProtoAnnouncement): Announcement => ({
  id: raw.id,
  title: raw.title ?? '',
  content: raw.content ?? '',
  pinned: raw.pinned ?? false,
  date: formatAnnouncementDate(ts(raw.published_at ?? raw.created_at)),
});

// ─── Preferences ─────────────────────────────────────────────────────────────

type ProtoNotificationPreferences = {
  email_notifications?: boolean;
  auction_alerts?: boolean;
  lottery_alerts?: boolean;
  event_reminders?: boolean;
  checkin_reminders?: boolean;
};

type ProtoUserPreferences = {
  notifications?: ProtoNotificationPreferences;
  updated_at?: string;
};

export const toUserPreferences = (raw: ProtoUserPreferences): UserPreferences => ({
  notifications: {
    emailNotifications: raw.notifications?.email_notifications ?? false,
    auctionAlerts: raw.notifications?.auction_alerts ?? false,
    lotteryAlerts: raw.notifications?.lottery_alerts ?? false,
    eventReminders: raw.notifications?.event_reminders ?? false,
    checkinReminders: raw.notifications?.checkin_reminders ?? false,
  },
  updatedAt: raw.updated_at ? ts(raw.updated_at) : undefined,
});

type ProtoItemHistoryEvent = {
  id?: string;
  kind?: string;
  source?: string;
  actor_id?: string;
  actor_name?: string;
  subject_id?: string;
  subject_name?: string;
  reference_id?: string;
  reference_label?: string;
  created_at?: string;
};

export const toItemHistoryEvent = (raw: ProtoItemHistoryEvent): ItemHistoryEvent => ({
  id: raw.id ?? '',
  kind: (raw.kind ?? 'received') as ItemHistoryKind,
  source: raw.source ?? '',
  actorId: raw.actor_id || undefined,
  actorName: raw.actor_name ?? '',
  subjectId: raw.subject_id || undefined,
  subjectName: raw.subject_name ?? '',
  referenceId: raw.reference_id || undefined,
  referenceLabel: raw.reference_label ?? '',
  createdAt: ts(raw.created_at),
});
