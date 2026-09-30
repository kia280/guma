// Mock implementation of ApiClient. Returns data from `./data`.
// Used when `NEXT_PUBLIC_USE_MOCK=true` for local frontend development.

import { getDevMockRole } from '@/lib/dev-mock';
import { emitLiveEvent } from '@/lib/live-events';
import { ownUserName } from '@/lib/user-name';
import type { AdminAnnouncement } from '@/types/admin';
import { AuctionStatus, type AuctionItem } from '@/types/auction';
import type { Announcement } from '@/types/dashboard';
import type { Guild } from '@/types/guild';
import type {
  BankContribution,
  FundRequest,
  GuildBank,
  GuildBankItem,
  ItemRequest,
} from '@/types/guild-bank';
import type { GuildEvent } from '@/types/guild-events';
import { ItemCategory, ItemRarity, type ItemHistoryEvent, type ItemLock, type ItemSourceRef } from '@/types/item';
import type { Lottery, LotteryTicket, LotteryWinner } from '@/types/lottery';
import type { GuildNotification } from '@/types/notification';
import { DEFAULT_NOTIFICATION_PREFERENCES, type NotificationPreferences } from '@/types/preference';
import { RollCallStatus } from '@/types/roll-call';
import type {
  Attendee,
  RollCall,
  RollCallGoldDistribution,
  RollCallGoldPot,
  RollCallTemplate,
  RollCallTemplateInput,
  ItemTemplate,
  ItemTemplateInput,
  LootItem,
} from '@/types/roll-call';
import type { User, UserStats } from '@/types/user';
import type { MemberAssets, Transaction, Wallet } from '@/types/wallet';
import { fromMinorUnits, roundGold, toMinorUnits } from '../money';
import type { ApiClient } from '../types';
import * as mockData from './data';
import { localizeMock } from './i18n';


/** In-memory store so mutations feel interactive during mock-mode development. */
const store = {
  rollCalls: [...mockData.mockRollCalls] as RollCall[],
  itemTemplates: mockData.mockItemTemplates.map(t => ({ ...t })) as ItemTemplate[],
  rollCallTemplates: mockData.mockRollCallTemplates.map(t => ({ ...t, itemTemplateIds: [...t.itemTemplateIds] })),
  auctions: [...mockData.mockAuctionItems] as AuctionItem[],
  transactions: [...mockData.mockTransactions] as Transaction[],
  lotteries: mockData.mockLotteries.map(l => ({ ...l, participants: l.participants?.map(p => ({ ...p })) })) as Lottery[],
  events: [] as GuildEvent[],
  announcements: [...mockData.mockAdminAnnouncements] as MockAnnouncement[],
  notifications: mockData.mockNotifications.map(n => ({ ...n })) as GuildNotification[],
  notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES } as NotificationPreferences,
  preferencesUpdatedAt: undefined as string | undefined,
  fundRequests: [] as FundRequest[],
  itemRequests: [] as ItemRequest[],
  bankBalance: 8750,
  rollCallGold: {} as Record<string, MockRollCallGold>,
};

type MockRollCallGold = {
  recipients: Record<string, number>;
  requests: Record<string, RollCallGoldDistribution>;
};

const rollCallGoldState = (rollCallId: string): MockRollCallGold =>
  (store.rollCallGold[rollCallId] ??= { recipients: {}, requests: {} });

const goldPot = (total: number, distributed: number, retracted: number): RollCallGoldPot => ({
  total,
  distributed,
  retracted,
  remaining: fromMinorUnits(toMinorUnits(total) - toMinorUnits(distributed) - toMinorUnits(retracted)),
});

const addGold = (a: number, b: number): number => fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));

const invalidArgument = (message: string) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status: 400, data: { code: 'InvalidArgument' } },
  });

const emitBankChanged = (guildId: string, resourceId: string) =>
  emitLiveEvent({ kind: 'resource', guildId, resource: 'bank', resourceId });

type StoredRollCallTemplate = Omit<RollCallTemplate, 'items'> & { itemTemplateIds: string[] };

const conflict = () =>
  Object.assign(new Error('a template with this name already exists'), {
    isAxiosError: true,
    response: { status: 409, data: { code: 'AlreadyExists' } },
  });

const failedPrecondition = (message: string) =>
  Object.assign(new Error(message), {
    isAxiosError: true,
    response: { status: 400, data: { code: 'FailedPrecondition' } },
  });

const removeById = <T extends { id: string }>(list: T[], id: string) => {
  const index = list.findIndex(entry => entry.id === id);
  if (index === -1) throw Object.assign(new Error('item not found'), { isAxiosError: true, response: { status: 404, data: { code: 'NotFound' } } });
  list.splice(index, 1);
};

const lockMockSource = (source: ItemSourceRef | undefined, lock: ItemLock) => {
  if (!source?.backpackItemId && !source?.bankItemId) return;
  const target = source.backpackItemId
    ? mockData.mockBackpackItems.find(entry => entry.id === source.backpackItemId)
    : mockData.mockGuildItems.find(entry => entry.id === source.bankItemId);
  if (!target) throw Object.assign(new Error('item not found'), { isAxiosError: true, response: { status: 404, data: { code: 'NotFound' } } });
  if (target.lock) throw failedPrecondition('item is already in an auction or lottery');
  target.lock = lock;
};

const notFound = () =>
  Object.assign(new Error('not found'), { isAxiosError: true, response: { status: 404, data: { code: 'NotFound' } } });

const releaseMockLocks = (lock: ItemLock) => {
  for (const entry of [...mockData.mockBackpackItems, ...mockData.mockGuildItems]) {
    if (entry.lock?.type === lock.type && entry.lock.id === lock.id) entry.lock = undefined;
  }
};

const assertUniqueName = (list: Array<{ id: string; name: string }>, id: string, name: string) => {
  if (list.some(t => t.id !== id && t.name === name)) throw conflict();
};

const resolveRollCallTemplate = (t: StoredRollCallTemplate): RollCallTemplate => ({
  id: t.id,
  name: t.name,
  title: t.title,
  items: t.itemTemplateIds.flatMap(itemId => store.itemTemplates.filter(item => item.id === itemId)),
});

const toStoredRollCallTemplate = (id: string, input: RollCallTemplateInput): StoredRollCallTemplate => ({
  id,
  name: input.name.trim(),
  title: input.title.trim(),
  itemTemplateIds: [...input.itemTemplateIds],
});

const toMockItemTemplate = (id: string, input: ItemTemplateInput): ItemTemplate => ({
  ...input,
  id,
  name: input.name.trim(),
  description: input.description.trim(),
});

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

type MockAnnouncement = AdminAnnouncement & { pinnedAt?: string };

const findMockAnnouncement = (id: string): MockAnnouncement => {
  const ann = store.announcements.find(a => a.id === id);
  if (!ann) throw new Error('announcement not found');
  return ann;
};

const announcementSortTime = (a: AdminAnnouncement) => new Date(a.publishedAt ?? a.updatedAt).getTime();

const announcementPinTime = (a: MockAnnouncement) =>
  a.status === 'published' && a.pinned ? new Date(a.pinnedAt ?? a.publishedAt ?? a.updatedAt).getTime() : 0;

const sortAdminAnnouncements = (list: MockAnnouncement[]) =>
  [...list].sort((a, b) =>
    Number(b.status === 'draft') - Number(a.status === 'draft')
    || announcementPinTime(b) - announcementPinTime(a)
    || announcementSortTime(b) - announcementSortTime(a));

const publishedMockAnnouncements = (): Announcement[] => [
  ...sortAdminAnnouncements(store.announcements.filter(a => a.status === 'published')).map(a => ({
    id: a.id,
    title: a.title,
    content: a.content,
    pinned: a.pinned,
    date: a.publishedAt ?? a.createdAt,
  })),
  ...mockData.ANNOUNCEMENTS,
];

const currentUser: User = {
  id: 'current-user',
  displayName: 'You',
  email: 'you@example.com',
  avatarUrl: '',
  bio: '',
  guildIds: [],
  currentGuildId: '',
  balance: 1250.75,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  emailVerified: true,
  discord: { provider: 'discord', subject: '0', username: 'you' },
  guildRole: getDevMockRole(),
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
    isPublic: true,
    currency: 'gold',
    features: { economy: true, events: true, raids: true, voting: false },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const defaultOwner = mockData.mockUsers[0];

const mockGuildSnapshot = (): Guild => ({
  ...mockGuild,
  ownerId: getDevMockRole() === 'owner' ? currentUser.id : defaultOwner.id,
});

const mockRoleOverrides = new Map<string, string>();

const mockMembers = () =>
  (getDevMockRole() === 'owner'
    ? mockData.mockUsers.map(user => (user.id === defaultOwner.id ? { ...user, role: 'admin' } : user))
    : mockData.mockUsers
  ).map(user => (mockRoleOverrides.has(user.id) ? { ...user, role: mockRoleOverrides.get(user.id) } : user));

const memberAssets = new Map<string, MemberAssets>();

const mockMemberAssets = (userId: string): MemberAssets => {
  let assets = memberAssets.get(userId);
  if (!assets) {
    const index = Math.max(0, mockData.mockUsers.findIndex(user => user.id === userId));
    const items = mockData.mockBackpackItems
      .filter((_, i) => (i + index) % 3 === 0)
      .map(item => ({ ...item, id: `${item.id}-${userId}`, ownerId: userId }));
    assets = { userId, balance: ((index * 7919) % 5000) + 120.5, items };
    memberAssets.set(userId, assets);
  }
  return assets;
};

const mockLockedBids = (): Pick<Wallet, 'lockedInBids' | 'lockedBids'> => {
  const lockedBids = store.auctions
    .filter(a => a.currentBidder?.id === currentUser.id && (a.status === AuctionStatus.ACTIVE || a.status === AuctionStatus.UPCOMING))
    .map(a => ({ auctionId: a.id, itemName: a.name, amount: a.currentBid, endTime: a.endTime }));
  return { lockedBids, lockedInBids: lockedBids.reduce((sum, bid) => sum + bid.amount, 0) };
};

const mockWallet = (guildId: string): Wallet => ({
  id: `wallet-${guildId}`,
  userId: currentUser.id,
  guildId,
  balance: currentUser.balance,
  currency: 'gold',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...mockLockedBids(),
});

const mockGuildBankData = (guildId: string): GuildBank => ({
  id: `bank-${guildId}`,
  guildId,
  balance: store.bankBalance,
  currency: 'gold',
  updatedAt: new Date().toISOString(),
});

const baseMockApiClient: ApiClient = {
  // ── Dashboard ──
  getDashboardData: async () => ({
    guildStats: mockData.GUILD_STATS,
    personalStats: { ...mockData.PERSONAL_STATS, balance: currentUser.balance },
    incomingEvents: mockData.INCOMING_EVENTS,
    announcements: publishedMockAnnouncements(),
  }),
  getAnnouncements: async () => publishedMockAnnouncements(),
  getFeedEvents: async () => mockData.INCOMING_EVENTS,

  // ── User ──
  getMe: async () => ({ ...currentUser, guildRole: getDevMockRole() }),
  updateMe: async (patch) => {
    Object.assign(
      currentUser,
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
      { updatedAt: new Date().toISOString() },
    );
    return { ...currentUser, guildRole: getDevMockRole() };
  },
  getUser: async (id) => ({ ...currentUser, id }),
  getUserStats: async (): Promise<UserStats> => mockData.PERSONAL_STATS,
  getBalanceTrend: async (_guildId, days = 30) => mockData.mockBalanceTrend(days),

  // ── Guild ──
  listGuilds: async (): Promise<Guild[]> => [mockGuildSnapshot()],
  getGuild: async () => mockGuildSnapshot(),
  getCurrentGuild: async () => mockGuildSnapshot(),
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
    return mockGuildSnapshot();
  },
  uploadGuildLogo: async (_id, image) => {
    Object.assign(mockGuild, { icon: URL.createObjectURL(image), updatedAt: new Date().toISOString() });
    return mockGuildSnapshot();
  },
  deleteGuildLogo: async () => {
    Object.assign(mockGuild, { icon: undefined, updatedAt: new Date().toISOString() });
    return mockGuildSnapshot();
  },
  joinGuild: async () => undefined,
  leaveGuild: async () => undefined,

  // ── Member ──
  listMembers: async () => mockMembers(),
  updateMemberRole: async (guildId, userId, role) => {
    const member = mockMembers().find(candidate => candidate.id === userId);
    if (!member) throw new Error('member not found');
    mockRoleOverrides.set(userId, role);
    emitLiveEvent({ kind: 'resource', guildId, resource: 'member', resourceId: userId });
    return { ...member, role };
  },
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
      date: new Date().toISOString(),
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
      date: new Date().toISOString(),
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
      date: new Date().toISOString(),
      status: 'completed',
      description: `Transfer to ${req.recipientId}`,
    };
    store.transactions.unshift(tx);
    return tx;
  },
  listBackpack: async () => mockData.mockBackpackItems,
  withdrawBackpackItem: async (_guildId, itemId) => {
    const item = mockData.mockBackpackItems.find(i => i.id === itemId);
    if (!item || item.deliveryRequestedAt || item.lock) throw failedPrecondition('item is not available to withdraw');
    item.deliveryRequestedAt = new Date().toISOString();
  },
  cancelBackpackWithdrawal: async (_guildId, itemId) => {
    const item = mockData.mockBackpackItems.find(i => i.id === itemId);
    if (!item?.deliveryRequestedAt) throw new Error('not pending');
    item.deliveryRequestedAt = undefined;
  },
  listPendingDeliveries: async () =>
    mockData.mockBackpackItems
      .filter(i => i.deliveryRequestedAt)
      .map(i => ({ ...i, ownerName: ownUserName(currentUser) })),
  confirmBackpackDelivery: async (_guildId, itemId) => {
    const item = mockData.mockBackpackItems.find(i => i.id === itemId);
    if (!item?.deliveryRequestedAt) throw new Error('not pending');
    removeById(mockData.mockBackpackItems, itemId);
  },
  transferBackpackItem: async (_guildId, itemId, req) => {
    const item = mockData.mockBackpackItems.find(i => i.id === itemId);
    if (!item) throw new Error('not found');
    if (item.lock) throw failedPrecondition('item is in an auction or lottery');
    removeById(mockData.mockBackpackItems, itemId);
    return { ...item, ownerId: req.recipientId, acquiredFrom: 'transfer', note: req.note };
  },
  listMemberAssets: async () =>
    mockMembers().map(member => {
      const assets = mockMemberAssets(member.id);
      return { userId: member.id, balance: assets.balance, itemCount: assets.items.length };
    }),
  getMemberAssets: async (_guildId, userId) => {
    const assets = mockMemberAssets(userId);
    return { ...assets, items: [...assets.items] };
  },
  adminTransferFunds: async (_guildId, userId, req) => {
    const source = mockMemberAssets(userId);
    if (req.amount <= 0 || req.amount > source.balance) throw failedPrecondition('insufficient funds');
    source.balance = roundGold(source.balance - req.amount);
    if (req.destination.kind === 'member') {
      const target = mockMemberAssets(req.destination.userId);
      target.balance = roundGold(target.balance + req.amount);
    }
    return source.balance;
  },
  adminTransferItems: async (_guildId, userId, req) => {
    const source = mockMemberAssets(userId);
    const moving = source.items.filter(item => req.itemIds.includes(item.id));
    if (moving.length !== req.itemIds.length || moving.some(item => item.lock || item.deliveryRequestedAt)) {
      throw failedPrecondition('item is not available to move');
    }
    source.items = source.items.filter(item => !req.itemIds.includes(item.id));
    if (req.destination.kind === 'member') {
      const target = mockMemberAssets(req.destination.userId);
      target.items.unshift(
        ...moving.map(item => ({ ...item, ownerId: target.userId, acquiredFrom: 'admin' as const, note: req.note })),
      );
    } else {
      mockData.mockGuildItems.unshift(
        ...moving.map(item => ({
          id: item.id,
          name: item.item.name,
          description: item.item.description,
          category: item.item.category,
          rarity: item.item.rarity,
          donatedBy: userId,
          donatedAt: new Date().toISOString(),
          quantity: 1,
          pendingRequestCount: 0,
          requestedByMe: false,
        })),
      );
    }
    return moving.map(item => item.id);
  },

  // ── Auction ──
  listAuctions: async (_guildId, filters) => {
    let items = localizeMock(store.auctions);
    if (filters?.status && filters.status !== 'all') {
      items = items.filter(i => i.status === filters.status?.toLowerCase());
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
    const auctionId = `auction-${now.getTime()}`;
    lockMockSource(req.source, { type: 'auction', id: auctionId });
    const item: AuctionItem = {
      id: auctionId,
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
      seller: { id: currentUser.id, username: ownUserName(currentUser) },
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
      bidder: { id: currentUser.id, username: ownUserName(currentUser) },
      amount,
      timestamp: new Date().toISOString(),
      isWinning: true,
    };
    item.bidHistory = [
      ...item.bidHistory.map(b => ({ ...b, isWinning: false })),
      bid,
    ];
    item.currentBid = amount;
    item.currentBidder = { id: currentUser.id, username: ownUserName(currentUser) };
    item.updatedAt = new Date().toISOString();
    return { auction: item, bid };
  },
  getBidHistory: async (_guildId, auctionId) => {
    const item = store.auctions.find(a => a.id === auctionId);
    return item?.bidHistory ?? [];
  },
  updateAuction: async (_guildId, id, patch) => {
    const item = store.auctions.find(a => a.id === id);
    if (!item) throw notFound();
    const isOpen = item.status === AuctionStatus.UPCOMING || item.status === AuctionStatus.ACTIVE;
    if (!isOpen || new Date(item.endTime).getTime() <= Date.now()) throw failedPrecondition('auction is no longer open');
    if (item.currentBidder && (patch.item || patch.startingBid !== undefined || patch.minBidIncrement !== undefined)) {
      const changed =
        (patch.startingBid !== undefined && patch.startingBid !== item.startingBid) ||
        (patch.minBidIncrement !== undefined && patch.minBidIncrement !== item.minBidIncrement) ||
        (patch.item && patch.item.name !== item.name);
      if (changed) throw failedPrecondition('pricing is locked after the first bid');
    }
    Object.assign(item, {
      ...(patch.item && !item.sourceType ? patch.item : {}),
      ...(patch.startingBid !== undefined ? { startingBid: patch.startingBid } : {}),
      ...(patch.minBidIncrement !== undefined ? { minBidIncrement: patch.minBidIncrement } : {}),
      ...(patch.startTime ? { startTime: patch.startTime } : {}),
      ...(patch.endTime ? { endTime: patch.endTime } : {}),
      updatedAt: new Date().toISOString(),
    });
    if (!item.currentBidder) item.currentBid = item.startingBid;
    return item;
  },
  cancelAuction: async (guildId, id) => {
    const item = store.auctions.find(a => a.id === id);
    if (!item) throw notFound();
    if (item.status !== AuctionStatus.UPCOMING && item.status !== AuctionStatus.ACTIVE) {
      throw failedPrecondition('auction is no longer open');
    }
    if (item.currentBidder?.id === currentUser.id) {
      currentUser.balance = Math.round((currentUser.balance + item.currentBid) * 100) / 100;
      emitLiveEvent({ kind: 'wallet', guildId, balance: currentUser.balance });
    }
    releaseMockLocks({ type: 'auction', id });
    item.bidHistory = item.bidHistory.map(bid => ({ ...bid, isWinning: false }));
    item.status = AuctionStatus.CANCELLED;
    item.cancelledAt = new Date().toISOString();
    return item;
  },
  deleteAuction: async (_guildId, id) => {
    const item = store.auctions.find(a => a.id === id);
    if (!item) throw notFound();
    if (item.status !== AuctionStatus.CANCELLED) throw failedPrecondition('only cancelled auctions can be deleted');
    store.auctions = store.auctions.filter(a => a.id !== id);
  },

  // ── Roll calls ──
  listRollCalls: async () => [...store.rollCalls],
  getRollCall: async (_guildId, id) => {
    const c = store.rollCalls.find(x => x.id === id);
    if (!c) throw new Error(`rollCall ${id} not found`);
    return c;
  },
  createRollCall: async (_guildId, req) => {
    const itemLoot = (req.lootList ?? []).filter(entry => entry.kind !== 'gold');
    const gold = (req.lootList ?? []).find(entry => entry.kind === 'gold')?.amount ?? 0;
    const entry: RollCall = {
      id: `ci-${Date.now()}`,
      status: RollCallStatus.OPEN,
      date: req.datetime ?? new Date().toISOString(),
      title: req.title,
      description: req.description || undefined,
      expireTime: req.expireTime,
      attendanceCount: 0,
      attendanceList: [],
      lootList: itemLoot.map<LootItem>((i, idx) => ({
        id: `l-${Date.now()}-${idx}`,
        name: i.name,
        quantity: i.quantity,
      })),
      goldLoot: gold > 0 ? goldPot(gold, 0, 0) : undefined,
      imageUrl: req.imageUrl,
    };
    store.rollCalls = [entry, ...store.rollCalls];
    store.bankBalance = addGold(store.bankBalance, gold);
    mockData.mockGuildItems.unshift(
      ...itemLoot.map((item, idx) => ({
        id: entry.lootList[idx].id,
        name: item.name,
        description: item.description ?? '',
        category: item.category ?? ItemCategory.MISC,
        rarity: item.rarity ?? ItemRarity.COMMON,
        donatedBy: ownUserName(currentUser),
        donatedAt: new Date().toISOString(),
        quantity: 1,
        pendingRequestCount: 0,
        requestedByMe: false,
        rollCallId: entry.id,
        rollCallTitle: req.title,
      })),
    );
    if (itemLoot.length || gold > 0) {
      mockData.mockContributions.unshift({
        id: `c-${entry.id}`,
        type: 'roll_call_loot',
        itemName: itemLoot.map(item => item.name).join(', ') || undefined,
        amount: gold > 0 ? gold : undefined,
        href: `/dashboard/roll-calls/${entry.id}`,
        member: ownUserName(currentUser),
        date: new Date().toISOString(),
        status: 'completed',
        note: req.title,
        rollCallId: entry.id,
      });
    }
    return entry;
  },
  updateRollCall: async (_guildId, id, patch) => {
    const idx = store.rollCalls.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('not found');
    const current = store.rollCalls[idx];
    if (current.status !== RollCallStatus.OPEN) throw new Error('rollCall is not open');
    store.rollCalls[idx] = {
      ...current,
      title: patch.title,
      description: patch.description || undefined,
      date: patch.datetime,
      expireTime: patch.expireTime,
      imageUrl: patch.imageUrl || undefined,
    };
    return store.rollCalls[idx];
  },
  deleteRollCall: async (_guildId, id) => {
    store.rollCalls = store.rollCalls.filter(c => c.id !== id);
  },
  cancelRollCall: async (_guildId, id) => {
    const entry = store.rollCalls.find(c => c.id === id);
    if (!entry) throw new Error('not found');
    if (entry.status !== RollCallStatus.OPEN || (entry.expireTime && new Date(entry.expireTime).getTime() <= Date.now())) {
      throw Object.assign(new Error('roll call is no longer open'), { response: { status: 400 } });
    }
    entry.status = RollCallStatus.CANCELLED;
    mockData.mockGuildItems
      .filter(item => item.rollCallId === id)
      .forEach(item => removeById(mockData.mockGuildItems, item.id));
    const pot = entry.goldLoot;
    if (pot && pot.remaining > 0) {
      store.bankBalance = addGold(store.bankBalance, -pot.remaining);
      mockData.mockContributions.unshift({
        id: `c-retract-${entry.id}`,
        type: 'roll_call_gold_retracted',
        amount: pot.remaining,
        member: ownUserName(currentUser),
        date: new Date().toISOString(),
        status: 'completed',
        note: entry.title,
        rollCallId: entry.id,
        href: `/dashboard/roll-calls/${entry.id}`,
      });
      entry.goldLoot = goldPot(pot.total, pot.distributed, addGold(pot.retracted, pot.remaining));
    }
    return entry;
  },
  completeRollCall: async (_guildId, id) => {
    const entry = store.rollCalls.find(c => c.id === id);
    if (!entry) throw notFound();
    const isExpired = !!entry.expireTime && new Date(entry.expireTime).getTime() <= Date.now();
    if (entry.status === RollCallStatus.CANCELLED || entry.status === RollCallStatus.COMPLETED || !isExpired) {
      throw failedPrecondition('roll call cannot be completed');
    }
    if (mockData.mockGuildItems.some(item => item.rollCallId === id) || (entry.goldLoot?.remaining ?? 0) > 0) {
      throw failedPrecondition('loot has not been distributed yet');
    }
    entry.status = RollCallStatus.COMPLETED;
    entry.completedAt = new Date().toISOString();
    return entry;
  },
  updateRollCallLoot: async (_guildId, id, lootList) => {
    const entry = store.rollCalls.find(c => c.id === id);
    if (!entry) throw notFound();
    if (entry.status === RollCallStatus.CANCELLED || entry.status === RollCallStatus.COMPLETED) {
      throw failedPrecondition('loot can no longer change');
    }
    const vault = new Map(mockData.mockGuildItems.filter(item => item.rollCallId === id).map(item => [item.id, item]));
    const kept = new Set(lootList.flatMap(item => (item.id ? [item.id] : [])));
    for (const item of entry.lootList) {
      const next = lootList.find(l => l.id === item.id);
      const isChanged = !next || next.name.trim() !== item.name;
      const bankItem = vault.get(item.id);
      if (isChanged && (!bankItem || bankItem.lock)) throw failedPrecondition(`${item.name} has left the guild vault`);
    }
    entry.lootList
      .filter(item => !kept.has(item.id))
      .forEach(item => removeById(mockData.mockGuildItems, item.id));
    entry.lootList = lootList.map((item, idx) => {
      const lootId = item.id ?? `l-${Date.now()}-${idx}`;
      const bankItem = vault.get(lootId);
      if (bankItem) bankItem.name = item.name.trim();
      if (!item.id) {
        mockData.mockGuildItems.unshift({
          id: lootId,
          name: item.name.trim(),
          description: item.description ?? '',
          category: item.category ?? ItemCategory.MISC,
          rarity: item.rarity ?? ItemRarity.COMMON,
          donatedBy: ownUserName(currentUser),
          donatedAt: new Date().toISOString(),
          quantity: 1,
          pendingRequestCount: 0,
          requestedByMe: false,
          rollCallId: entry.id,
          rollCallTitle: entry.title,
        });
      }
      return {
        id: lootId,
        name: item.name.trim(),
        description: item.description,
        category: item.category ?? ItemCategory.MISC,
        rarity: item.rarity ?? ItemRarity.COMMON,
      };
    });
    return entry;
  },
  checkIn: async (_guildId, rollCallId, notes): Promise<Attendee> => {
    const entry = store.rollCalls.find(c => c.id === rollCallId);
    if (!entry) throw new Error('not found');
    if (entry.status === RollCallStatus.CANCELLED) {
      throw Object.assign(new Error('roll call has been cancelled'), { response: { status: 400 } });
    }
    if (entry.expireTime && new Date(entry.expireTime).getTime() <= Date.now()) {
      throw Object.assign(new Error('roll call has expired'), { response: { status: 400 } });
    }
    if (entry.attendanceList.some(a => a.userId === currentUser.id)) {
      throw Object.assign(new Error('already checked in to this roll call'), { response: { status: 409 } });
    }
    const attendee: Attendee = {
      id: `a-${Date.now()}`,
      userId: currentUser.id,
      username: ownUserName(currentUser),
      checkedInAt: new Date().toISOString(),
      ...(notes?.trim() ? { notes: notes.trim() } : {}),
    };
    entry.attendanceList = [...entry.attendanceList, attendee];
    entry.attendanceCount = entry.attendanceList.length;
    return attendee;
  },
  assignLoot: async (_guildId, _rollCallId, itemId) => {
    if (mockData.mockGuildItems.find(i => i.id === itemId)?.lock) throw failedPrecondition('loot is in an auction or lottery');
    removeById(mockData.mockGuildItems, itemId);
  },
  listAttendees: async (_guildId, rollCallId) => {
    const entry = store.rollCalls.find(c => c.id === rollCallId);
    return entry?.attendanceList ?? [];
  },
  getRollCallGold: async (_guildId, rollCallId) => {
    const entry = store.rollCalls.find(c => c.id === rollCallId);
    if (!entry) throw notFound();
    const state = rollCallGoldState(rollCallId);
    return {
      pot: entry.goldLoot,
      recipients: Object.entries(state.recipients).map(([userId, amount]) => ({ userId, amount })),
    };
  },
  distributeRollCallGold: async (guildId, rollCallId, requestId, payouts) => {
    const entry = store.rollCalls.find(c => c.id === rollCallId);
    if (!entry) throw notFound();
    const state = rollCallGoldState(rollCallId);
    const previous = state.requests[requestId];
    if (previous) return { ...previous, replayed: true };
    const lines = payouts.filter(p => p.amount !== 0);
    if (payouts.some(p => p.amount < 0) || lines.length === 0) throw invalidArgument('invalid payouts');
    if (new Set(payouts.map(p => p.userId)).size !== payouts.length) throw invalidArgument('duplicate recipient');
    const pot = entry.goldLoot;
    if (!pot || entry.status === RollCallStatus.CANCELLED) throw failedPrecondition('no gold to distribute');
    if (lines.some(p => !entry.attendanceList.some(a => a.userId === p.userId))) {
      throw failedPrecondition('recipient did not check in');
    }
    const total = fromMinorUnits(lines.reduce((sum, p) => sum + toMinorUnits(p.amount), 0));
    if (toMinorUnits(total) > toMinorUnits(pot.remaining)) throw failedPrecondition('pot is insufficient');

    lines.forEach(p => {
      state.recipients[p.userId] = addGold(state.recipients[p.userId] ?? 0, p.amount);
      if (p.userId === currentUser.id) {
        currentUser.balance = addGold(currentUser.balance, p.amount);
        store.transactions.unshift({
          id: `tx-${Date.now()}`,
          type: 'deposit',
          kind: 'ROLL_CALL_GOLD',
          amount: p.amount,
          date: new Date().toISOString(),
          status: 'completed',
          description: entry.title,
          referenceType: 'roll_call',
          referenceId: entry.id,
        });
        emitLiveEvent({ kind: 'wallet', guildId, balance: currentUser.balance });
      }
    });
    entry.goldLoot = goldPot(pot.total, addGold(pot.distributed, total), pot.retracted);
    store.bankBalance = addGold(store.bankBalance, -total);
    mockData.mockContributions.unshift({
      id: `c-payout-${requestId}`,
      type: 'roll_call_gold_payout',
      amount: total,
      member: ownUserName(currentUser),
      date: new Date().toISOString(),
      status: 'completed',
      note: entry.title,
      rollCallId: entry.id,
      href: `/dashboard/roll-calls/${entry.id}`,
    });
    const result: RollCallGoldDistribution = { pot: entry.goldLoot, payouts: lines, replayed: false };
    state.requests[requestId] = result;
    emitBankChanged(guildId, rollCallId);
    return result;
  },
  listRollCallTemplates: async () => store.rollCallTemplates.map(resolveRollCallTemplate).sort(byName),
  createRollCallTemplate: async (_guildId, input) => {
    const template = toStoredRollCallTemplate(`tpl-${Date.now()}`, input);
    assertUniqueName(store.rollCallTemplates, template.id, template.name);
    store.rollCallTemplates = [...store.rollCallTemplates, template];
    return resolveRollCallTemplate(template);
  },
  updateRollCallTemplate: async (_guildId, id, input) => {
    if (!store.rollCallTemplates.some(t => t.id === id)) throw new Error('not found');
    const template = toStoredRollCallTemplate(id, input);
    assertUniqueName(store.rollCallTemplates, id, template.name);
    store.rollCallTemplates = store.rollCallTemplates.map(t => (t.id === id ? template : t));
    return resolveRollCallTemplate(template);
  },
  deleteRollCallTemplate: async (_guildId, id) => {
    store.rollCallTemplates = store.rollCallTemplates.filter(t => t.id !== id);
  },
  listItemTemplates: async () => [...store.itemTemplates].sort(byName),
  createItemTemplate: async (_guildId, input) => {
    const template = toMockItemTemplate(`item-${Date.now()}`, input);
    assertUniqueName(store.itemTemplates, template.id, template.name);
    store.itemTemplates = [...store.itemTemplates, template];
    return template;
  },
  updateItemTemplate: async (_guildId, id, input) => {
    if (!store.itemTemplates.some(t => t.id === id)) throw new Error('not found');
    const template = toMockItemTemplate(id, input);
    assertUniqueName(store.itemTemplates, id, template.name);
    store.itemTemplates = store.itemTemplates.map(t => (t.id === id ? template : t));
    return template;
  },
  deleteItemTemplate: async (_guildId, id) => {
    store.itemTemplates = store.itemTemplates.filter(t => t.id !== id);
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
    const lotteryId = `lottery-${Date.now()}`;
    req.prizes?.forEach(prize => lockMockSource(prize.source, { type: 'lottery', id: lotteryId }));
    const lottery: Lottery = {
      id: lotteryId,
      title: req.title,
      description: req.description ?? '',
      prizes: req.prizes?.map(prize => ({ rank: prize.rank, description: prize.description, amount: prize.amount })),
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
  updateLottery: async (_guildId, lotteryId, patch) => {
    const lottery = store.lotteries.find(x => x.id === lotteryId);
    if (!lottery) throw notFound();
    if (lottery.status === 'ended' || lottery.status === 'cancelled') throw failedPrecondition('lottery is no longer open');
    if (patch.drawDate && new Date(patch.drawDate).getTime() <= Date.now()) throw failedPrecondition('draw date must be in the future');
    const pricingChanged =
      (patch.ticketPrice !== undefined && patch.ticketPrice !== lottery.ticketPrice) ||
      (patch.maxTickets !== undefined && patch.maxTickets !== lottery.maxTickets);
    if (lottery.ticketsSold > 0 && pricingChanged) throw failedPrecondition('ticket settings are locked after the first sale');
    Object.assign(lottery, {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.drawDate ? { drawDate: patch.drawDate } : {}),
      ...(patch.ticketPrice !== undefined ? { ticketPrice: patch.ticketPrice } : {}),
      ...(patch.maxTickets !== undefined ? { maxTickets: patch.maxTickets } : {}),
    });
    return lottery;
  },
  cancelLottery: async (guildId, lotteryId) => {
    const lottery = store.lotteries.find(x => x.id === lotteryId);
    if (!lottery) throw notFound();
    if (lottery.status === 'ended' || lottery.status === 'cancelled') throw failedPrecondition('lottery is no longer open');
    const mine = lottery.participants?.find(p => p.id === currentUser.id)?.tickets ?? 0;
    if (mine > 0) {
      currentUser.balance = Math.round((currentUser.balance + mine * lottery.ticketPrice) * 100) / 100;
      emitLiveEvent({ kind: 'wallet', guildId, balance: currentUser.balance });
    }
    releaseMockLocks({ type: 'lottery', id: lotteryId });
    Object.assign(lottery, { status: 'cancelled', cancelledAt: new Date().toISOString() });
    return lottery;
  },
  deleteLottery: async (_guildId, lotteryId) => {
    const lottery = store.lotteries.find(x => x.id === lotteryId);
    if (!lottery) throw notFound();
    if (lottery.status !== 'cancelled') throw failedPrecondition('only cancelled lotteries can be deleted');
    store.lotteries = store.lotteries.filter(x => x.id !== lotteryId);
  },
  purchaseTickets: async (guildId, lotteryId, quantity): Promise<LotteryTicket[]> => {
    const lottery = store.lotteries.find(x => x.id === lotteryId);
    if (!lottery) throw new Error('not found');
    if (lottery.status === 'ended' || lottery.status === 'cancelled') throw failedPrecondition('lottery is not open for ticket purchase');
    if (lottery.maxTickets > 0 && lottery.ticketsSold + quantity > lottery.maxTickets) {
      throw failedPrecondition('not enough tickets available');
    }
    const cost = quantity * lottery.ticketPrice;
    if (cost > currentUser.balance) throw failedPrecondition('insufficient funds');
    currentUser.balance = Math.round((currentUser.balance - cost) * 100) / 100;
    emitLiveEvent({ kind: 'wallet', guildId, balance: currentUser.balance });
    const participants = [...(lottery.participants ?? [])];
    const mine = participants.find(p => p.id === currentUser.id);
    if (mine) mine.tickets += quantity;
    else participants.unshift({ id: currentUser.id, username: ownUserName(currentUser), tickets: quantity });
    Object.assign(lottery, {
      ticketsSold: lottery.ticketsSold + quantity,
      participants: participants.sort((a, b) => b.tickets - a.tickets),
    });
    return Array.from({ length: quantity }, (_, i) => ({
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
          ? [{ id: `w-${Date.now()}`, userId: winner.id, username: winner.username, prize: '', prizeAmount: lottery.prizePool }]
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
    username: ownUserName(currentUser),
    amount: req.amount,
    note: req.note,
    createdAt: new Date().toISOString(),
    kind: 'gold',
    itemNames: [],
  }),
  requestFunds: async (guildId, req): Promise<FundRequest> => {
    const request: FundRequest = {
      id: `fr-${Date.now()}`,
      guildId,
      requesterId: currentUser.id,
      requesterName: ownUserName(currentUser),
      amount: req.amount,
      reason: req.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.fundRequests.push(request);
    return request;
  },
  reviewFundRequest: async (_guildId, reqId, status, note): Promise<FundRequest> => {
    const request = store.fundRequests.find(r => r.id === reqId);
    if (!request || request.status !== 'pending') throw new Error('not found');
    Object.assign(request, { status, reviewNote: note, reviewedAt: new Date().toISOString() });
    return request;
  },
  listFundRequests: async (_guildId, status): Promise<FundRequest[]> =>
    store.fundRequests.filter(r => !status || r.status === status),
  listContributions: async () => mockData.mockContributions,
  donateItem: async (_guildId, backpackItemId): Promise<GuildBankItem> => {
    const bp = mockData.mockBackpackItems.find(i => i.id === backpackItemId);
    if (!bp) throw new Error('not found');
    if (bp.lock) throw failedPrecondition('item is in an auction or lottery');
    removeById(mockData.mockBackpackItems, backpackItemId);
    const donated: GuildBankItem = {
      id: `gi-${Date.now()}`,
      name: bp.item.name,
      description: bp.item.description,
      category: bp.item.category,
      rarity: bp.item.rarity,
      donatedBy: ownUserName(currentUser),
      donatedAt: new Date().toISOString(),
      quantity: 1,
      pendingRequestCount: 0,
      requestedByMe: false,
    };
    mockData.mockGuildItems.unshift(donated);
    return donated;
  },
  listBankItems: async (_guildId, options) =>
    options?.rollCallId ? mockData.mockGuildItems.filter(item => item.rollCallId === options.rollCallId) : mockData.mockGuildItems,
  deleteBankItem: async (_guildId, bankItemId) => {
    const bankItem = mockData.mockGuildItems.find(i => i.id === bankItemId);
    if (!bankItem) throw notFound();
    if (bankItem.lock) throw failedPrecondition('item is in an auction or lottery');
    const reviewedAt = new Date().toISOString();
    store.itemRequests
      .filter(r => r.bankItemId === bankItemId && r.status === 'pending')
      .forEach(r => Object.assign(r, { status: 'rejected', reviewedAt }));
    removeById(mockData.mockGuildItems, bankItemId);
  },
  requestItem: async (guildId, bankItemId, reason): Promise<ItemRequest> => {
    const bankItem = mockData.mockGuildItems.find(i => i.id === bankItemId);
    if (!bankItem) throw new Error('not found');
    if (bankItem.lock) throw failedPrecondition('item is in an auction or lottery');
    if (bankItem.requestedByMe) throw conflict();
    bankItem.requestedByMe = true;
    bankItem.pendingRequestCount += 1;
    const request: ItemRequest = {
      id: `ir-${Date.now()}`,
      guildId,
      bankItemId,
      requesterId: currentUser.id,
      requesterName: ownUserName(currentUser),
      reason,
      status: 'pending',
      itemName: bankItem.name,
      itemCategory: bankItem.category,
      itemRarity: bankItem.rarity,
      createdAt: new Date().toISOString(),
    };
    store.itemRequests.push(request);
    return request;
  },
  reviewItemRequest: async (_guildId, reqId, status, note): Promise<ItemRequest> => {
    const request = store.itemRequests.find(r => r.id === reqId);
    if (!request || request.status !== 'pending') throw new Error('not found');
    Object.assign(request, { status, reviewNote: note, reviewedAt: new Date().toISOString() });
    const bankItem = mockData.mockGuildItems.find(i => i.id === request.bankItemId);
    if (bankItem) {
      bankItem.pendingRequestCount = Math.max(0, bankItem.pendingRequestCount - 1);
      if (request.requesterId === currentUser.id) bankItem.requestedByMe = false;
      if (status === 'approved') removeById(mockData.mockGuildItems, bankItem.id);
    }
    return request;
  },
  listItemRequests: async (_guildId, status): Promise<ItemRequest[]> =>
    store.itemRequests.filter(r => !status || r.status === status),
  getItemHistory: async (_guildId, itemId): Promise<ItemHistoryEvent[]> => {
    const backpackItem = mockData.mockBackpackItems.find(i => i.id === itemId);
    const bankItem = mockData.mockGuildItems.find(i => i.id === itemId);
    const events: ItemHistoryEvent[] = [];
    const event = (kind: ItemHistoryEvent['kind'], createdAt: string, extra: Partial<ItemHistoryEvent> = {}) =>
      events.push({ id: `${itemId}-${events.length}`, kind, source: '', actorName: '', subjectName: '', referenceLabel: '', createdAt, ...extra });
    if (bankItem) {
      if (bankItem.rollCallId) {
        event('looted', bankItem.donatedAt, { source: 'roll_call', actorName: bankItem.donatedBy, referenceId: bankItem.rollCallId, referenceLabel: bankItem.rollCallTitle ?? '' });
      } else {
        event('donated', bankItem.donatedAt, { actorName: bankItem.donatedBy });
      }
      store.itemRequests
        .filter(r => r.bankItemId === itemId)
        .forEach(r => event('requested', r.createdAt, { actorName: r.requesterName, referenceId: r.id }));
    }
    if (backpackItem) {
      const earlier = new Date(new Date(backpackItem.acquiredAt).getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      event('looted', earlier, { source: 'roll_call', actorName: 'Night吃貨', referenceLabel: 'Boss raid' });
      event('received', backpackItem.acquiredAt, {
        source: backpackItem.acquiredFrom,
        actorName: ownUserName(currentUser),
        referenceId: backpackItem.sourceId,
        referenceLabel: backpackItem.sourceLabel ?? '',
        subjectName: backpackItem.acquiredFrom === 'transfer' ? backpackItem.sourceLabel ?? '' : '',
      });
    }
    return events;
  },

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
      createdByName: ownUserName(currentUser),
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

  // ── Notifications ──
  listNotifications: async ({ unreadOnly = false, pageSize = 20, pageToken } = {}) => {
    const matching = unreadOnly ? store.notifications.filter(n => !n.isRead) : store.notifications;
    const offset = Number(pageToken ?? 0) || 0;
    const next = offset + pageSize;
    return {
      notifications: matching.slice(offset, next).map(n => ({ ...n })),
      nextPageToken: next < matching.length ? String(next) : undefined,
      totalCount: matching.length,
      unreadCount: store.notifications.filter(n => !n.isRead).length,
    };
  },
  getUnreadNotificationCount: async () => store.notifications.filter(n => !n.isRead).length,
  markNotificationRead: async (id) => {
    const found = store.notifications.find(n => n.id === id);
    if (!found) throw new Error('notification not found');
    found.isRead = true;
    return { ...found };
  },
  markAllNotificationsRead: async () => {
    const unread = store.notifications.filter(n => !n.isRead);
    unread.forEach(n => {
      n.isRead = true;
    });
    return unread.length;
  },

  // ── Preferences ──
  getMyPreferences: async () => ({
    notifications: { ...store.notificationPreferences },
    updatedAt: store.preferencesUpdatedAt,
  }),
  updateNotificationPreferences: async (patch) => {
    Object.assign(
      store.notificationPreferences,
      Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    );
    store.preferencesUpdatedAt = new Date().toISOString();
    return {
      notifications: { ...store.notificationPreferences },
      updatedAt: store.preferencesUpdatedAt,
    };
  },

  // ── Admin ──
  getAdminActivity: async () => mockData.mockActivity,
  getGuildStats: async (guildId) => ({
    memberCount: mockData.mockUsers.length,
    bankBalance: mockGuildBankData(guildId).balance,
    bankCurrency: mockGuildBankData(guildId).currency,
    activeEventCount: mockData.GUILD_STATS.activeEvents,
    bankItemCount: mockData.mockGuildItems.length,
  }),
  getAdminAnnouncements: async () => sortAdminAnnouncements(store.announcements).map(a => ({ ...a })),
  getAnnouncement: async (_guildId, id) => ({ ...findMockAnnouncement(id) }),
  createAnnouncementDraft: async () => {
    const now = new Date().toISOString();
    const ann: AdminAnnouncement = {
      id: `ann-${Date.now()}`,
      title: '',
      content: '',
      pinned: false,
      status: 'draft',
      author: ownUserName(currentUser),
      createdAt: now,
      updatedAt: now,
    };
    store.announcements = [ann, ...store.announcements];
    return { ...ann };
  },
  updateAnnouncement: async (_guildId, id, input) => {
    const ann = findMockAnnouncement(id);
    if (ann.status === 'published' && (!input.title.trim() || !input.content.trim())) {
      throw new Error('published announcements require a title and content');
    }
    const now = new Date().toISOString();
    const pinnedAt = input.pinned ? (ann.pinned ? ann.pinnedAt ?? ann.publishedAt ?? now : now) : undefined;
    Object.assign(ann, input, { pinnedAt, updatedAt: now });
    return { ...ann };
  },
  publishAnnouncement: async (_guildId, id) => {
    const ann = findMockAnnouncement(id);
    if (ann.status !== 'draft') throw new Error('announcement is already published');
    if (!ann.title.trim() || !ann.content.trim()) throw new Error('title and content are required to publish');
    const now = new Date().toISOString();
    Object.assign(ann, { status: 'published', publishedAt: now, pinnedAt: ann.pinned ? now : undefined, updatedAt: now });
    return { ...ann };
  },
  unpublishAnnouncement: async (_guildId, id) => {
    const ann = findMockAnnouncement(id);
    if (ann.status !== 'published') throw new Error('announcement is not published');
    Object.assign(ann, { status: 'draft', publishedAt: undefined, updatedAt: new Date().toISOString() });
    return { ...ann };
  },
  deleteAnnouncementDraft: async (_guildId, id) => {
    const ann = findMockAnnouncement(id);
    if (ann.status !== 'draft') throw new Error('only drafts can be deleted');
    store.announcements = store.announcements.filter(a => a.id !== id);
  },
};

export const mockApiClient = Object.fromEntries(
  Object.entries(baseMockApiClient).map(([name, method]) => [
    name,
    async (...args: unknown[]) => localizeMock(await (method as (...a: unknown[]) => unknown)(...args)),
  ]),
) as unknown as ApiClient;
