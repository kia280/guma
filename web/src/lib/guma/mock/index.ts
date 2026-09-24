// Mock implementation of ApiClient. Returns data from `./data`.
// Used when `NEXT_PUBLIC_USE_MOCK=true` for local frontend development.

import * as mockData from './data';
import { localizeMock } from './i18n';
import { AuctionStatus, type AuctionItem } from '@/types/auction';
import type {
  AttendanceMember,
  CheckinEntry,
  LootItem,
} from '@/types/checkin';
import { CheckinStatus } from '@/types/checkin';
import type { User, UserStats } from '@/types/user';
import type { Guild } from '@/types/guild';
import type {
  BankContribution,
  FundRequest,
  GuildBank,
  GuildBankItem,
  ItemRequest,
} from '@/types/guild-bank';
import type { GuildEvent } from '@/types/guild-events';
import type { Lottery, LotteryTicket, LotteryWinner } from '@/types/lottery';
import type { Transaction, Wallet } from '@/types/wallet';
import type { AdminAnnouncement } from '@/types/admin';
import type { ApiClient } from '../types';


/** In-memory store so mutations feel interactive during mock-mode development. */
const store = {
  checkins: [...mockData.mockCheckins] as CheckinEntry[],
  auctions: [...mockData.mockAuctionItems] as AuctionItem[],
  transactions: [...mockData.mockTransactions] as Transaction[],
  lotteries: mockData.mockLotteries.map(l => ({ ...l, participants: l.participants?.map(p => ({ ...p })) })) as Lottery[],
  events: [] as GuildEvent[],
  announcements: [...mockData.mockAdminAnnouncements] as AdminAnnouncement[],
};

const currentUser: User = {
  id: 'current-user',
  username: 'You',
  displayName: 'You',
  email: 'you@example.com',
  avatarUrl: '',
  bio: '',
  guildIds: [],
  currentGuildId: '',
  balance: 1250,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockGuild: Guild = {
  id: 'mock-guild',
  name: 'Sunbaby Guild',
  description: '',
  ownerId: mockData.mockUsers[0].id,
  memberCount: mockData.mockUsers.length,
  settings: {
    timezone: 'Asia/Taipei',
    language: 'zht',
    currency: 'gold',
    features: { economy: true, events: true, raids: true, voting: false },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockWallet = (guildId: string): Wallet => ({
  id: `wallet-${guildId}`,
  userId: currentUser.id,
  guildId,
  balance: 1250.75,
  currency: 'gold',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const mockGuildBankData = (guildId: string): GuildBank => ({
  id: `bank-${guildId}`,
  guildId,
  balance: 8750,
  currency: 'gold',
  goal: 10000,
  updatedAt: new Date().toISOString(),
});

const baseMockApiClient: ApiClient = {
  // ── Dashboard ──
  getDashboardData: async () => ({
    guildStats: mockData.GUILD_STATS,
    personalStats: mockData.PERSONAL_STATS,
    balanceTrend: mockData.dashboardBalanceTrend,
    incomingEvents: mockData.INCOMING_EVENTS,
    announcements: mockData.ANNOUNCEMENTS,
  }),
  getAnnouncements: async () => mockData.ANNOUNCEMENTS,
  getFeedEvents: async () => mockData.INCOMING_EVENTS,

  // ── User ──
  getMe: async () => currentUser,
  updateMe: async (patch) => {
    Object.assign(
      currentUser,
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
      { updatedAt: new Date().toISOString() },
    );
    return { ...currentUser };
  },
  getUser: async (id) => ({ ...currentUser, id }),
  getUserStats: async (): Promise<UserStats> => mockData.PERSONAL_STATS,
  getBalanceTrend: async () => mockData.dashboardBalanceTrend,

  // ── Guild ──
  listGuilds: async (): Promise<Guild[]> => [{ ...mockGuild }],
  getGuild: async () => ({ ...mockGuild }),
  getCurrentGuild: async () => ({ ...mockGuild }),
  createGuild: async req => ({
    ...mockGuild,
    id: `guild-${Date.now()}`,
    name: req.name,
    description: req.description,
    ownerId: currentUser.id,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  updateGuild: async (_id, patch) => {
    Object.assign(mockGuild, patch, { updatedAt: new Date().toISOString() });
    return { ...mockGuild };
  },
  joinGuild: async () => undefined,
  leaveGuild: async () => undefined,

  // ── Member ──
  listMembers: async () => mockData.mockUsers,
  inviteMember: async (guildId, req) => ({
    id: `inv-${Date.now()}`,
    guildId,
    code: 'MOCK-CODE',
    inviterId: currentUser.id,
    email: req.email,
    role: req.role,
    createdAt: new Date().toISOString(),
  }),

  // ── Wallet ──
  getWallet: async (guildId) => mockWallet(guildId),
  listTransactions: async () => store.transactions,
  deposit: async (_guildId, amount) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'deposit',
      amount,
      date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      description: 'Account deposit',
    };
    store.transactions.unshift(tx);
    return tx;
  },
  withdraw: async (_guildId, amount) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'withdraw',
      amount: -Math.abs(amount),
      date: new Date().toISOString().slice(0, 10),
      status: 'pending',
      description: 'Withdrawal request',
    };
    store.transactions.unshift(tx);
    return tx;
  },
  transfer: async (_guildId, req) => {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      type: 'transfer',
      amount: -Math.abs(req.amount),
      recipient: req.recipientId,
      date: new Date().toISOString().slice(0, 10),
      status: 'completed',
      description: `Transfer to ${req.recipientId}`,
    };
    store.transactions.unshift(tx);
    return tx;
  },
  listBackpack: async () => mockData.mockBackpackItems,
  withdrawBackpackItem: async () => undefined,

  // ── Auction ──
  listAuctions: async (_guildId, filters) => {
    let items = localizeMock(store.auctions);
    if (filters?.status && filters.status !== 'all') {
      items = items.filter(i => i.status === filters.status);
    }
    if (filters?.category && filters.category !== 'all') {
      items = items.filter(i => i.category === filters.category);
    }
    if (filters?.rarity && filters.rarity !== 'all') {
      items = items.filter(i => i.rarity === filters.rarity);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q),
      );
    }
    return items;
  },
  getAuction: async (_guildId, id) => {
    const item = store.auctions.find(a => a.id === id);
    if (!item) throw new Error(`auction ${id} not found`);
    return item;
  },
  createAuction: async (guildId, req) => {
    const now = new Date();
    const item: AuctionItem = {
      id: `auction-${now.getTime()}`,
      name: req.name,
      description: req.description,
      category: req.category,
      rarity: req.rarity,
      imageUrl: req.imageUrl,
      startingBid: req.startingBid,
      currentBid: req.startingBid,
      minBidIncrement: req.minBidIncrement,
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + req.duration * 60 * 60 * 1000).toISOString(),
      status: AuctionStatus.ACTIVE,
      guildId,
      sellerId: currentUser.id,
      seller: { id: currentUser.id, username: currentUser.username },
      bidHistory: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    store.auctions = [item, ...store.auctions];
    return item;
  },
  placeBid: async (_guildId, auctionId, amount) => {
    const item = store.auctions.find(a => a.id === auctionId);
    if (!item) throw new Error('not found');
    const bid = {
      id: `bid-${Date.now()}`,
      auctionItemId: auctionId,
      bidderId: currentUser.id,
      bidder: { id: currentUser.id, username: currentUser.username },
      amount,
      timestamp: new Date().toISOString(),
      isWinning: true,
    };
    item.bidHistory = [
      ...item.bidHistory.map(b => ({ ...b, isWinning: false })),
      bid,
    ];
    item.currentBid = amount;
    item.currentBidder = { id: currentUser.id, username: currentUser.username };
    item.updatedAt = new Date().toISOString();
    return { auction: item, bid };
  },
  getBidHistory: async (_guildId, auctionId) => {
    const item = store.auctions.find(a => a.id === auctionId);
    return item?.bidHistory ?? [];
  },
  cancelAuction: async (_guildId, id) => {
    const item = store.auctions.find(a => a.id === id);
    if (!item) throw new Error('not found');
    item.status = AuctionStatus.CANCELLED;
    return item;
  },

  // ── CheckIn ──
  listCheckins: async () => store.checkins,
  getCheckin: async (_guildId, id) => {
    const c = store.checkins.find(x => x.id === id);
    if (!c) throw new Error(`checkin ${id} not found`);
    return c;
  },
  createCheckin: async (_guildId, req) => {
    const entry: CheckinEntry = {
      id: `ci-${Date.now()}`,
      status: CheckinStatus.OPEN,
      date: req.datetime ? new Date(req.datetime).toLocaleString() : new Date().toLocaleString(),
      description: req.title,
      expireTime: req.expireTime,
      attendanceList: [],
      lootList: (req.lootList ?? []).map<LootItem>((i, idx) => ({
        id: `l-${Date.now()}-${idx}`,
        name: i.name,
        quantity: i.quantity,
      })),
      imageUrl: req.imageUrl,
    };
    store.checkins = [entry, ...store.checkins];
    return entry;
  },
  updateCheckin: async (_guildId, id, patch) => {
    const idx = store.checkins.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('not found');
    store.checkins[idx] = {
      ...store.checkins[idx],
      description: patch.title ?? store.checkins[idx].description,
      expireTime: patch.expireTime ?? store.checkins[idx].expireTime,
      imageUrl: patch.imageUrl ?? store.checkins[idx].imageUrl,
    };
    return store.checkins[idx];
  },
  deleteCheckin: async (_guildId, id) => {
    store.checkins = store.checkins.filter(c => c.id !== id);
  },
  submitAttendance: async (_guildId, checkinId): Promise<AttendanceMember> => {
    const entry = store.checkins.find(c => c.id === checkinId);
    if (!entry) throw new Error('not found');
    const attendee: AttendanceMember = {
      id: `a-${Date.now()}`,
      username: currentUser.username,
      checkedInAt: new Date().toISOString(),
    };
    entry.attendanceList = [...entry.attendanceList, attendee];
    entry.status = CheckinStatus.FINISHED;
    return attendee;
  },
  listAttendees: async (_guildId, checkinId) => {
    const entry = store.checkins.find(c => c.id === checkinId);
    return entry?.attendanceList ?? [];
  },

  // ── Lottery ──
  listLotteries: async (_guildId, status) => {
    if (!status || status === 'all') return store.lotteries;
    return store.lotteries.filter(l => l.status === status);
  },
  getLottery: async (_guildId, id) => {
    const l = store.lotteries.find(x => x.id === id);
    if (!l) throw new Error(`lottery ${id} not found`);
    return l;
  },
  createLottery: async (_guildId, req) => {
    const lottery: Lottery = {
      id: `lottery-${Date.now()}`,
      title: req.title,
      prizePool: req.prizes?.reduce((sum, prize) => sum + (prize.amount ?? 0), 0) ?? 0,
      ticketPrice: req.ticketPrice,
      drawDate: req.drawDate,
      ticketsSold: 0,
      maxTickets: req.maxTickets ?? 0,
      status: 'active',
      participants: [],
    };
    store.lotteries = [lottery, ...store.lotteries];
    return lottery;
  },
  purchaseTickets: async (_guildId, lotteryId, quantity): Promise<LotteryTicket[]> => {
    const lottery = store.lotteries.find(x => x.id === lotteryId);
    if (!lottery) throw new Error('not found');
    const bought = Math.min(quantity, lottery.maxTickets - lottery.ticketsSold);
    const participants = [...(lottery.participants ?? [])];
    const mine = participants.find(p => p.id === currentUser.id);
    if (mine) mine.tickets += bought;
    else participants.unshift({ id: currentUser.id, username: currentUser.username, tickets: bought });
    Object.assign(lottery, {
      ticketsSold: lottery.ticketsSold + bought,
      participants: participants.sort((a, b) => b.tickets - a.tickets),
    });
    return Array.from({ length: bought }, (_, i) => ({
      id: `ticket-${Date.now()}-${i}`,
      lotteryId,
      userId: currentUser.id,
      ticketNumber: `T-${Date.now()}-${i}`,
      purchasedAt: new Date().toISOString(),
    }));
  },
  getLotteryWinners: async (_guildId, id): Promise<LotteryWinner[]> => {
    const lottery = store.lotteries.find(x => x.id === id);
    if (!lottery) return [];
    if (lottery.status === 'active' && new Date(lottery.drawDate).getTime() <= Date.now()) {
      const participants = lottery.participants ?? [];
      const total = participants.reduce((sum, p) => sum + p.tickets, 0);
      let roll = Math.random() * total;
      const winner = participants.find(p => (roll -= p.tickets) < 0) ?? participants[0];
      Object.assign(lottery, {
        status: 'ended',
        winners: winner
          ? [{ id: `w-${Date.now()}`, username: winner.username, prize: `$${lottery.prizePool.toLocaleString('en-US')}` }]
          : [],
      });
    }
    return lottery.winners ?? [];
  },
  listMyTickets: async () => [],

  // ── Bank ──
  getGuildBank: async (guildId) => mockGuildBankData(guildId),
  contributeFunds: async (guildId, req): Promise<BankContribution> => ({
    id: `bc-${Date.now()}`,
    guildId,
    userId: currentUser.id,
    username: currentUser.username,
    amount: req.amount,
    note: req.note,
    createdAt: new Date().toISOString(),
  }),
  requestFunds: async (guildId, req): Promise<FundRequest> => ({
    id: `fr-${Date.now()}`,
    guildId,
    requesterId: currentUser.id,
    requesterName: currentUser.username,
    amount: req.amount,
    reason: req.reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),
  reviewFundRequest: async (guildId, reqId, status): Promise<FundRequest> => ({
    id: reqId,
    guildId,
    requesterId: '',
    requesterName: '',
    amount: 0,
    reason: '',
    status,
    createdAt: new Date().toISOString(),
  }),
  listFundRequests: async (): Promise<FundRequest[]> => [],
  listContributions: async () => mockData.mockContributions,
  donateItem: async (_guildId, backpackItemId): Promise<GuildBankItem> => {
    const bp = mockData.mockBackpackItems.find(i => i.id === backpackItemId);
    if (!bp) throw new Error('not found');
    return {
      id: `gi-${Date.now()}`,
      name: bp.item.name,
      description: bp.item.description,
      category: bp.item.category,
      rarity: bp.item.rarity,
      donatedBy: currentUser.username,
      donatedAt: new Date().toISOString(),
      quantity: 1,
    };
  },
  listBankItems: async () => mockData.mockGuildItems,
  requestItem: async (guildId, bankItemId, reason): Promise<ItemRequest> => ({
    id: `ir-${Date.now()}`,
    guildId,
    bankItemId,
    requesterId: currentUser.id,
    requesterName: currentUser.username,
    reason,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }),

  // ── Events ──
  listEvents: async () => store.events,
  getEvent: async (_guildId, id) => {
    const e = store.events.find(x => x.id === id);
    if (!e) throw new Error('not found');
    return e;
  },
  createEvent: async (_guildId, data) => {
    const ev: GuildEvent = {
      ...data,
      id: `evt-${Date.now()}`,
      participants: [],
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.events = [...store.events, ev];
    return ev;
  },
  updateEvent: async (_guildId, id, data) => {
    const idx = store.events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('not found');
    store.events[idx] = {
      ...store.events[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    return store.events[idx];
  },
  deleteEvent: async (_guildId, id) => {
    store.events = store.events.filter(e => e.id !== id);
  },

  // ── Admin ──
  getAdminActivity: async () => mockData.mockActivity,
  getAdminAnnouncements: async () => store.announcements,
  createAnnouncement: async (req) => {
    const ann: AdminAnnouncement = {
      id: `ann-${Date.now()}`,
      title: req.title,
      content: req.content,
      pinned: req.pinned ?? false,
      author: currentUser.username,
      createdAt: new Date().toISOString(),
    };
    store.announcements = [ann, ...store.announcements];
    return ann;
  },
};

export const mockApiClient = Object.fromEntries(
  Object.entries(baseMockApiClient).map(([name, method]) => [
    name,
    async (...args: unknown[]) => localizeMock(await (method as (...a: unknown[]) => unknown)(...args)),
  ]),
) as unknown as ApiClient;
