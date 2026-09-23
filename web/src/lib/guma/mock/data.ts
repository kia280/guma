/**
 * Centralized mock data client.
 * All pages and components should import mock data from here
 * instead of defining inline mock data.
 *
 * When the real API client is ready, replace the exports in this
 * file with actual API calls — consumers stay unchanged.
 */

import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';
import { BackpackItem } from '@/types/backpack';
import { GuildEvent, CreateEventData, UpdateEventData } from '@/types/guild-events';
import { CheckinStatus, CheckinEntry } from '@/types/checkin';
import type { MockUser, BalancePoint } from '@/types/user';
import type {
  FeedEvent,
  EventKind,
  Announcement,
  GuildStats,
  PersonalStats,
} from '@/types/dashboard';
import type { AdminActivity, AdminAnnouncement } from '@/types/admin';
import type { Transaction } from '@/types/wallet';
import type { Lottery } from '@/types/lottery';
import type { GuildContribution, GuildBankItem } from '@/types/guild-bank';
import type { GuildNotification } from '@/types/notification';

export type {
  MockUser,
  FeedEvent,
  EventKind,
  Announcement,
  AdminActivity,
  AdminAnnouncement,
  Transaction,
  Lottery,
  GuildContribution,
  GuildBankItem,
};

// ─── Shared user list ────────────────────────────────────────────────────────

const MEMBER_COUNT = 300;

const NAME_PREFIXES = [
  '熊', '桑', '夜', '星', '月', '風', '雪', '影', '龍', '貓',
  'Shadow', 'Storm', 'Frost', 'Iron', 'Silver', 'Night', 'Moon', 'Sun', 'Blood', 'Crystal',
  '달빛', '그림자', '폭풍', '별빛', '불꽃', '하늘', '용', '검은',
];

const NAME_SUFFIXES = [
  '寶寶', '小隊長', '劍士', '法師', '射手', '不睡', '吃貨', '大俠',
  'Blade', 'Hunter', 'Knight', 'Mage', 'Wolf', 'Fox', 'Rider', 'Walker',
  '전사', '기사', '마법사', '궁수', '도적', '사냥꾼',
];

const LAST_ACTIVE = ['just now', '2 min ago', '15 min ago', '1h ago', '3h ago', '8h ago', '1d ago', '3d ago', '1w ago'];

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roleFor(n: number): string {
  if (n === 1) return 'owner';
  if (n <= 4) return 'admin';
  if (n % 40 === 0) return 'moderator';
  return 'member';
}

function generateMembers(): MockUser[] {
  const random = seededRandom(20260923);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const names = NAME_PREFIXES.flatMap(prefix => NAME_SUFFIXES.map(suffix => prefix + suffix))
    .sort(() => random() - 0.5);

  return Array.from({ length: MEMBER_COUNT }, (_, i) => {
    const n = i + 1;
    const roll = random();
    return {
      id: `u${n}`,
      username: names[i] ?? `Member${n}`,
      email: `member${n}@example.com`,
      role: roleFor(n),
      status: roll < 0.02 ? 'banned' : roll < 0.27 ? 'online' : 'offline',
      lastActive: pick(LAST_ACTIVE),
    };
  });
}

export const mockUsers: MockUser[] = generateMembers();

const member = (n: number): MockUser => mockUsers[n - 1];

const memberRef = (n: number) => ({ id: member(n).id, username: member(n).username });

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const GUILD_STATS: GuildStats = {
  members: mockUsers.length,
  activeEvents: 5,
  balance: 128_450,
  checkinsThisWeek: 31,
  activeAuctions: 3,
  openLotteries: 2,
};

export const PERSONAL_STATS: PersonalStats = {
  balance: 5_000,
  checkinsThisMonth: 7,
  activeAuctions: 3,
  activityPoints: 340,
};

export const dashboardBalanceTrend: BalancePoint[] = [
  { day: 'Feb 1', balance: 3200 },
  { day: 'Feb 4', balance: 3800 },
  { day: 'Feb 7', balance: 3500 },
  { day: 'Feb 10', balance: 4100 },
  { day: 'Feb 13', balance: 3900 },
  { day: 'Feb 16', balance: 4400 },
  { day: 'Feb 19', balance: 4200 },
  { day: 'Feb 22', balance: 4750 },
  { day: 'Feb 25', balance: 5000 },
];

export const INCOMING_EVENTS: FeedEvent[] = [
  { id: '1', kind: 'auction', title: 'Dragon Slayer Sword', subtitle: 'Auction ending soon', timeLabel: '6h remaining', urgency: 'high' },
  { id: '2', kind: 'checkin', title: 'Weekly Guild Check-in', subtitle: 'Open — awaiting your check-in', timeLabel: 'Open now', urgency: 'high' },
  { id: '3', kind: 'lottery', title: 'Spring Giveaway Draw', subtitle: '$2,500 prize pool', timeLabel: 'Draws in 2d 4h', urgency: 'medium' },
  { id: '4', kind: 'auction', title: 'Mystic Shield of Protection', subtitle: 'Active auction', timeLabel: '12h remaining', urgency: 'medium' },
  { id: '5', kind: 'calendar', title: 'Guild Strategy Meeting', subtitle: 'Recurring weekly event', timeLabel: 'Tomorrow 20:00', urgency: 'low' },
  { id: '6', kind: 'lottery', title: 'Monthly Mega Draw', subtitle: 'You have 3 tickets', timeLabel: 'Draws in 5d', urgency: 'low' },
];

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    title: '有任何問題，請回報給抽貝比',
    date: '2024/07/24',
    pinned: true,
    content:
      '公會成員若遇到任何系統問題、功能錯誤或其他疑問，請直接私訊抽貝比。回報時請附上問題描述與截圖，以便快速處理。感謝大家的配合！',
  },
  {
    id: 2,
    title: 'Guild raid night every Friday at 21:00',
    date: '2024/07/20',
    pinned: false,
    content:
      'All guild members are welcome to join our weekly raid night every Friday starting at 21:00 server time. Please ensure your gear is up to date and bring consumables. Loot will be distributed via the in-guild auction system. See you there!',
  },
];

// ─── Admin ───────────────────────────────────────────────────────────────────

export const mockActivity: AdminActivity[] = [
  { id: 'a1', actor: member(7).username, action: 'placed a bid on Dragon Slayer Sword', actionType: 'auction', timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  { id: 'a2', actor: member(12).username, action: 'checked in to weekly guild check-in', actionType: 'checkin', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString() },
  { id: 'a3', actor: member(23).username, action: 'purchased 2 lottery tickets', actionType: 'lottery', timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
  { id: 'a4', actor: member(40).username, action: 'joined the guild', actionType: 'join', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: 'a5', actor: member(1).username, action: 'created auction for Mystic Shield', actionType: 'auction', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
  { id: 'a6', actor: member(45).username, action: 'checked in to raid preparation', actionType: 'checkin', timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
];

export const mockAdminAnnouncements: AdminAnnouncement[] = [
  {
    id: 'ann1',
    title: 'Weekly Raid Night - Friday 8PM',
    content: 'This Friday we will be tackling the Ancient Dragon. All members level 50+ are encouraged to join.',
    pinned: true,
    author: member(1).username,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ann2',
    title: 'Guild Treasury Update',
    content: 'The guild treasury has been updated. Auction proceeds for this month have been distributed.',
    pinned: false,
    author: member(1).username,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Wallet ──────────────────────────────────────────────────────────────────

export const mockTransactions: Transaction[] = [
  { id: '1', type: 'deposit', amount: 500.0, date: '2024-01-20', status: 'completed', description: 'Account deposit' },
  { id: '2', type: 'transfer', amount: -100.0, recipient: member(7).username, date: '2024-01-19', status: 'completed', description: `Transfer to ${member(7).username}` },
  { id: '3', type: 'withdraw', amount: -500.0, date: '2024-01-18', status: 'pending', description: 'Withdrawal request' },
  { id: '4', type: 'transfer', amount: -75.5, recipient: member(12).username, date: '2024-01-17', status: 'completed', description: `Transfer to ${member(12).username}` },
  { id: '5', type: 'deposit', amount: 1000.0, date: '2024-01-16', status: 'completed', description: 'Guild reward payout' },
  { id: '6', type: 'transfer', amount: -200.0, recipient: member(23).username, date: '2024-01-15', status: 'completed', description: `Transfer to ${member(23).username}` },
  { id: '7', type: 'withdraw', amount: -250.0, date: '2024-01-14', status: 'completed', description: 'Withdrawal to bank account' },
  { id: '8', type: 'deposit', amount: 300.0, date: '2024-01-13', status: 'completed', description: 'Auction sale proceeds' },
  { id: '9', type: 'transfer', amount: -50.0, recipient: member(31).username, date: '2024-01-12', status: 'failed', description: `Transfer to ${member(31).username}` },
  { id: '10', type: 'deposit', amount: 150.0, date: '2024-01-11', status: 'completed', description: 'Lottery winnings' },
  { id: '11', type: 'transfer', amount: -80.0, recipient: member(40).username, date: '2024-01-10', status: 'completed', description: `Transfer to ${member(40).username}` },
  { id: '12', type: 'withdraw', amount: -100.0, date: '2024-01-09', status: 'completed', description: 'Withdrawal to bank account' },
];

export const walletBalanceTrend: BalancePoint[] = [
  { day: 'Jan 1', balance: 800 },
  { day: 'Jan 5', balance: 950 },
  { day: 'Jan 9', balance: 870 },
  { day: 'Jan 13', balance: 1100 },
  { day: 'Jan 17', balance: 1050 },
  { day: 'Jan 21', balance: 1200 },
  { day: 'Jan 25', balance: 1150 },
  { day: 'Jan 29', balance: 1300 },
  { day: 'Feb 2', balance: 1250 },
];

export const mockBackpackItems: BackpackItem[] = [
  {
    id: 'bp1',
    item: {
      id: 'item-bp1',
      name: 'Ancient Sword',
      description: 'A blade passed down through generations, still sharp as ever.',
      category: ItemCategory.WEAPON,
      rarity: ItemRarity.RARE,
    },
    acquiredFrom: 'auction',
    acquiredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp2',
    item: {
      id: 'item-bp2',
      name: 'Lucky Charm',
      description: 'A small trinket said to bring good fortune in battle.',
      category: ItemCategory.ACCESSORY,
      rarity: ItemRarity.UNCOMMON,
    },
    acquiredFrom: 'lottery',
    acquiredAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp3',
    item: {
      id: 'item-bp3',
      name: 'Iron Shield',
      description: 'Standard issue protective gear for guild members.',
      category: ItemCategory.ARMOR,
      rarity: ItemRarity.COMMON,
    },
    acquiredFrom: 'admin',
    acquiredAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
  {
    id: 'bp4',
    item: {
      id: 'item-bp4',
      name: 'Health Potion',
      description: 'Restores 50% maximum health when consumed.',
      category: ItemCategory.CONSUMABLE,
      rarity: ItemRarity.COMMON,
    },
    acquiredFrom: 'transfer',
    acquiredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ownerId: 'current-user',
    guildId: 'guild1',
  },
];

// ─── Checkin ─────────────────────────────────────────────────────────────────

const CHECKIN_COUNT = 16;

const CHECKIN_BOSSES = ['蜘蛛', '炎龍', '骷髏王', '深淵魔女', '巨石像', '冰霜巨人'];

const CHECKIN_LOOT = ['Dragon Scale', 'Fire Crystal', 'Web Fragment', 'Venom Fang', 'Spider Silk', 'Ancient Rune', 'Frost Core', 'Shadow Essence'];

const HOUR = 60 * 60 * 1000;

function formatCheckinDate(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function checkinStatusFor(i: number): CheckinStatus {
  if (i < 3) return CheckinStatus.OPEN;
  if (i % 5 === 4) return CheckinStatus.CLOSED;
  return CheckinStatus.FINISHED;
}

function generateCheckins(): CheckinEntry[] {
  const random = seededRandom(20240724);
  const now = Date.now();

  return Array.from({ length: CHECKIN_COUNT }, (_, i) => {
    const status = checkinStatusFor(i);
    const start = now - (i * 8 + 1) * HOUR;
    const attendeeCount = 20 + Math.floor(random() * 60);
    const attendees = [...mockUsers].sort(() => random() - 0.5).slice(0, attendeeCount);
    const attendanceList = attendees
      .map((user, j) => ({
        id: `c${i + 1}-a${j + 1}`,
        username: user.username,
        checkedInAt: new Date(start + random() * HOUR).toISOString(),
        ...(random() < 0.05 ? { notes: 'Late arrival' } : {}),
      }))
      .sort((x, y) => x.checkedInAt.localeCompare(y.checkedInAt));
    const lootList = [...CHECKIN_LOOT]
      .sort(() => random() - 0.5)
      .slice(0, Math.floor(random() * 5))
      .map((name, j) => ({
        id: `c${i + 1}-l${j + 1}`,
        name,
        quantity: 1 + Math.floor(random() * 10),
        ...(status === CheckinStatus.FINISHED
          ? { winner: attendees[Math.floor(random() * attendees.length)].username }
          : {}),
      }));

    return {
      id: String(i + 1),
      imageUrl: `/mock/checkin/checkin-${(i % 4) + 1}.webp`,
      status,
      date: formatCheckinDate(start),
      description: CHECKIN_BOSSES[i % CHECKIN_BOSSES.length],
      ...(status === CheckinStatus.CLOSED ? { isDisabled: true } : {}),
      expireTime: new Date(status === CheckinStatus.OPEN ? now + (i + 1) * 2 * HOUR : start + 2 * HOUR).toISOString(),
      attendanceList,
      lootList,
    };
  });
}

export const mockCheckins: CheckinEntry[] = generateCheckins();

// ─── Auction ─────────────────────────────────────────────────────────────────

export const mockAuctionItems: AuctionItem[] = [
  {
    id: '1',
    name: 'Dragon Slayer Sword',
    description: 'A legendary blade forged from dragon scales. Increases critical hit rate by 25%.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.LEGENDARY,
    startingBid: 1000,
    currentBid: 2500,
    currentBidder: memberRef(7),
    minBidIncrement: 100,
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: member(1).id,
    seller: memberRef(1),
    bidHistory: [
      { id: 'bid1', auctionItemId: '1', bidderId: member(23).id, bidder: memberRef(23), amount: 1000, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isWinning: false },
      { id: 'bid2', auctionItemId: '1', bidderId: member(7).id, bidder: memberRef(7), amount: 2500, timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), isWinning: true },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Mystic Shield of Protection',
    description: 'An enchanted shield that provides magical protection and reflects 15% damage.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.EPIC,
    startingBid: 800,
    currentBid: 800,
    minBidIncrement: 50,
    startTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: member(31).id,
    seller: memberRef(31),
    bidHistory: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Ancient Healing Scroll',
    description: 'A powerful healing spell that restores 80% of maximum health instantly.',
    category: ItemCategory.SKILL_SCROLL,
    rarity: ItemRarity.RARE,
    startingBid: 500,
    currentBid: 750,
    currentBidder: memberRef(12),
    minBidIncrement: 25,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.UPCOMING,
    guildId: 'guild1',
    sellerId: member(45).id,
    seller: memberRef(45),
    bidHistory: [
      { id: 'bid3', auctionItemId: '3', bidderId: member(12).id, bidder: memberRef(12), amount: 750, timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), isWinning: true },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Rare Mithril Ore',
    description: 'High-quality crafting material used to forge superior weapons and armor.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.UNCOMMON,
    startingBid: 200,
    currentBid: 350,
    currentBidder: memberRef(40),
    minBidIncrement: 25,
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: AuctionStatus.ENDED,
    guildId: 'guild1',
    sellerId: member(58).id,
    seller: memberRef(58),
    bidHistory: [
      { id: 'bid4', auctionItemId: '4', bidderId: member(40).id, bidder: memberRef(40), amount: 350, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), isWinning: true },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Shadow Cloak of the Assassin',
    description: 'A mysterious cloak that conceals the wearer in darkness. Details hidden until auction ends.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.MYTHIC,
    isBlind: true,
    startingBid: 3000,
    currentBid: 3000,
    minBidIncrement: 200,
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: member(1).id,
    seller: memberRef(1),
    bidHistory: [],
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

export const USER_BALANCE = 5000;

// ─── Lottery ─────────────────────────────────────────────────────────────────

export const mockLotteries: Lottery[] = [
  {
    id: 'l1',
    title: 'Grand Guild Lottery',
    prizePool: 10000,
    ticketPrice: 50,
    drawDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 142,
    maxTickets: 200,
    status: 'active',
    winners: undefined,
  },
  {
    id: 'l2',
    title: 'Weekly Mini Draw',
    prizePool: 1500,
    ticketPrice: 10,
    drawDate: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 88,
    maxTickets: 100,
    status: 'active',
    winners: undefined,
  },
  {
    id: 'l3',
    title: 'Legendary Item Raffle',
    prizePool: 5000,
    ticketPrice: 100,
    drawDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 15,
    maxTickets: 50,
    status: 'upcoming',
    winners: undefined,
  },
  {
    id: 'l4',
    title: 'Monthly Mega Draw',
    prizePool: 25000,
    ticketPrice: 200,
    drawDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 125,
    maxTickets: 125,
    status: 'ended',
    winners: [
      { id: 'w1', username: member(7).username, prize: '$12,500 (1st place)' },
      { id: 'w2', username: member(12).username, prize: '$7,500 (2nd place)' },
      { id: 'w3', username: member(23).username, prize: '$5,000 (3rd place)' },
    ],
  },
];

// ─── Guild Bank ──────────────────────────────────────────────────────────────

export const mockContributions: GuildContribution[] = [
  { id: '1', type: 'contribute', amount: 500, member: member(7).username, date: '2024-01-15', status: 'completed', note: 'Weekly contribution' },
  { id: '2', type: 'request', amount: 200, member: member(12).username, date: '2024-01-14', status: 'approved', note: 'Potion supplies for raid' },
  { id: '3', type: 'item_donate', itemName: 'Dragon Scale', member: member(23).username, date: '2024-01-13', status: 'completed' },
  { id: '4', type: 'contribute', amount: 1000, member: member(1).username, date: '2024-01-12', status: 'completed', note: 'Initial guild fund' },
  { id: '5', type: 'request', amount: 350, member: member(31).username, date: '2024-01-16', status: 'pending', note: 'Enchanting materials' },
  { id: '6', type: 'item_distribute', itemName: 'Ancient Sword', member: member(40).username, date: '2024-01-11', status: 'completed', note: 'Distributed by admin' },
];

export const mockGuildItems: GuildBankItem[] = [
  {
    id: 'gi1',
    name: 'Dragon Scale',
    description: 'A durable scale from a defeated dragon. Used for crafting high-tier armor.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.RARE,
    donatedBy: member(23).username,
    donatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 5,
  },
  {
    id: 'gi2',
    name: 'Elixir of Strength',
    description: 'Grants a powerful temporary boost to physical abilities.',
    category: ItemCategory.CONSUMABLE,
    rarity: ItemRarity.UNCOMMON,
    donatedBy: member(1).username,
    donatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 12,
  },
  {
    id: 'gi3',
    name: 'Tome of Arcane Secrets',
    description: 'An ancient spellbook containing forgotten knowledge of arcane arts.',
    category: ItemCategory.SKILL_SCROLL,
    rarity: ItemRarity.EPIC,
    donatedBy: member(31).username,
    donatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 1,
  },
  {
    id: 'gi4',
    name: 'Iron Ore Bundle',
    description: 'A bulk bundle of iron ore for crafting basic equipment.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.COMMON,
    donatedBy: member(40).username,
    donatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 50,
  },
];

// ─── Guild Events (mock API) ─────────────────────────────────────────────────

export const mockGuildEventsApi = {
  getEvents: async (guildId: string): Promise<GuildEvent[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));

    const stored = localStorage.getItem(`guild-events-${guildId}`);
    if (stored) return JSON.parse(stored);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        id: '1',
        title: 'Dragon Boss Respawn',
        description: 'Ancient Dragon respawns in the eastern mountains',
        type: 'boss_respawn',
        startDate: tomorrow.toISOString(),
        isAllDay: false,
        location: 'Eastern Mountains',
        isRecurring: true,
        recurringPattern: { type: 'daily', interval: 1 },
        priority: 'high',
        createdBy: 'admin',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: '2',
        title: 'Guild War vs Dragon Slayers',
        description: 'Prepare for battle!',
        type: 'guild_war',
        startDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        isAllDay: false,
        isRecurring: false,
        priority: 'critical',
        createdBy: 'admin',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ];
  },

  createEvent: async (guildId: string, eventData: CreateEventData): Promise<GuildEvent> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newEvent: GuildEvent = {
      ...eventData,
      id: Date.now().toString(),
      participants: [],
      createdBy: 'current-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    events.push(newEvent);
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(events));
    return newEvent;
  },

  updateEvent: async (guildId: string, eventData: UpdateEventData): Promise<GuildEvent> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    const eventIndex = events.findIndex(e => e.id === eventData.id);
    if (eventIndex === -1) throw new Error('Event not found');
    const updatedEvent = { ...events[eventIndex], ...eventData, updatedAt: new Date().toISOString() };
    events[eventIndex] = updatedEvent;
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(events));
    return updatedEvent;
  },

  deleteEvent: async (guildId: string, eventId: string): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stored = localStorage.getItem(`guild-events-${guildId}`);
    const events: GuildEvent[] = stored ? JSON.parse(stored) : [];
    const filteredEvents = events.filter(e => e.id !== eventId);
    localStorage.setItem(`guild-events-${guildId}`, JSON.stringify(filteredEvents));
  },
};

// ─── Notifications ───────────────────────────────────────────────────────────

const MINUTE = 60 * 1000;

export const mockNotifications: GuildNotification[] = [
  {
    id: 'n1',
    kind: 'tradeOffer',
    params: { actor: member(7).username, give: 'Fire Crystal ×2', want: 'Venom Fang ×1' },
    createdAt: new Date(Date.now() - 4 * MINUTE).toISOString(),
    isRead: false,
  },
  {
    id: 'n2',
    kind: 'transferReceived',
    params: { actor: member(12).username, amount: 250 },
    createdAt: new Date(Date.now() - 18 * MINUTE).toISOString(),
    isRead: false,
    href: '/dashboard/wallet',
  },
  {
    id: 'n3',
    kind: 'attendanceSettled',
    params: { event: mockCheckins[3].description, reward: 120 },
    createdAt: new Date(Date.now() - 55 * MINUTE).toISOString(),
    isRead: false,
    href: `/dashboard/attendance/${mockCheckins[3].id}`,
  },
  {
    id: 'n4',
    kind: 'lootWon',
    params: { event: mockCheckins[5].description, item: 'Shadow Essence', quantity: 3 },
    createdAt: new Date(Date.now() - 2 * 60 * MINUTE).toISOString(),
    isRead: false,
    href: `/dashboard/attendance/${mockCheckins[5].id}`,
  },
  {
    id: 'n5',
    kind: 'auctionOutbid',
    params: { actor: member(23).username, item: 'Dragon Slayer Sword', amount: 2600 },
    createdAt: new Date(Date.now() - 3 * 60 * MINUTE).toISOString(),
    isRead: false,
    href: '/dashboard/auction/1',
  },
  {
    id: 'n6',
    kind: 'tradeOffer',
    params: { actor: member(31).username, give: 'Ancient Rune ×1', want: 'Frost Core ×4' },
    createdAt: new Date(Date.now() - 9 * 60 * MINUTE).toISOString(),
    isRead: true,
    response: 'declined',
  },
  {
    id: 'n7',
    kind: 'auctionWon',
    params: { item: 'Rare Mithril Ore', amount: 350 },
    createdAt: new Date(Date.now() - 26 * 60 * MINUTE).toISOString(),
    isRead: true,
    href: '/dashboard/auction/4',
  },
  {
    id: 'n8',
    kind: 'lotteryWon',
    params: { lottery: 'Monthly Mega Draw', prize: 'Lucky Charm' },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * MINUTE).toISOString(),
    isRead: true,
    href: '/dashboard/lottery',
  },
  {
    id: 'n9',
    kind: 'bankRequestApproved',
    params: { actor: member(1).username, amount: 200 },
    createdAt: new Date(Date.now() - 3 * 24 * 60 * MINUTE).toISOString(),
    isRead: true,
    href: '/dashboard/guild-bank',
  },
];
