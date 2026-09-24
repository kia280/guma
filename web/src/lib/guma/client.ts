// HTTP-backed implementation of ApiClient. Calls the guma grpc-gateway at
// `env.api.url` and translates proto-wire responses (snake_case, nested Item)
// into the UI shape via transforms.

import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '@/lib/env';
import { clearSession } from '@/lib/session';
import type { ApiClient } from './types';
import type { UserStats } from '@/types/user';
import type { Guild } from '@/types/guild';
import type { AdminAnnouncement } from '@/types/admin';
import { toAuctionItem, toAttendee, toBackpackItem, toBankContribution, toBid, toCheckin, toFundRequest, toGuildBank, toGuildBankItem, toGuildContributions, toGuildEvent, toItemRequest, toLottery, toLotteryTicket, toLotteryWinner, toMember, toTransaction, toUser, toWallet } from './transforms';

const http: AxiosInstance = axios.create({
  baseURL: env.api.url,
  withCredentials: true, // Send Kratos session cookies
  headers: { 'Content-Type': 'application/json' },
});

// Kratos session cookies are the primary auth mechanism, but keep Bearer
// token support as a fallback for any endpoint that expects it.
http.interceptors.request.use((cfg) => {
  if (typeof window === 'undefined') return cfg;
  const token = localStorage.getItem('auth_token');
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

const MUTATING_METHODS = new Set(['post', 'put', 'patch', 'delete']);
const mutationListeners = new Set<() => void>();

export const onApiMutation = (listener: () => void) => {
  mutationListeners.add(listener);
  return () => {
    mutationListeners.delete(listener);
  };
};

http.interceptors.response.use(
  (r) => {
    if (MUTATING_METHODS.has(r.config.method ?? '')) {
      mutationListeners.forEach(listener => listener());
    }
    return r;
  },
  async (error: AxiosError) => {
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      window.location.pathname !== '/login'
    ) {
      // await clearSession();
    }
    return Promise.reject(error);
  },
);

const notImpl = (name: string) => () =>
  Promise.reject(new Error(`gumaApiClient.${name} is not yet wired to a backend endpoint`));

export const gumaApiClient: ApiClient = {
  // ── Dashboard / Guma ──
  getDashboardData: async (guildId) => {
    const { data } = await http.get(`/v1/dashboard/${guildId}`);
    return {
      guildStats: data.guild_stats ?? {
        members: 0, activeEvents: 0, balance: 0, checkinsThisWeek: 0, activeAuctions: 0, openLotteries: 0,
      },
      personalStats: data.personal_stats ?? {
        balance: 0, checkinsThisMonth: 0, activeAuctions: 0, activityPoints: 0,
      },
      balanceTrend: data.balance_trend ?? [],
      incomingEvents: data.incoming_events ?? [],
      announcements: data.announcements ?? [],
    };
  },
  getAnnouncements: async () => [],
  getFeedEvents: async () => [],

  // ── User ──
  getMe: async () => {
    const { data } = await http.get('/v1/me');
    return toUser(data.user ?? {});
  },
  updateMe: async (patch) => {
    const { data } = await http.patch('/v1/me', {
      display_name: patch.displayName,
      username: patch.username,
      bio: patch.bio,
      avatar_url: patch.avatarUrl,
    });
    return toUser(data.user ?? {});
  },
  getUser: async (id) => {
    const { data } = await http.get(`/v1/users/${id}`);
    return toUser(data.user ?? {});
  },
  getUserStats: async () => {
    const { data } = await http.get('/v1/me/stats');
    return (data.stats ?? data) as UserStats;
  },
  getBalanceTrend: async () => {
    const { data } = await http.get('/v1/me/balance-trend');
    return data.points ?? [];
  },

  // ── Guild ──
  listGuilds: async () => {
    const { data } = await http.get('/v1/guilds');
    return (data.guilds ?? []) as Guild[];
  },
  getGuild: async (id) => {
    const { data } = await http.get(`/v1/guilds/${id}`);
    return data.guild as Guild;
  },
  getCurrentGuild: async () => {
    try {
      const { data } = await http.get('/v1/guilds/current');
      return (data.guild as Guild) ?? null;
    } catch {
      return null;
    }
  },
  createGuild: async (req) => {
    const { data } = await http.post('/v1/guilds', req);
    return data.guild as Guild;
  },
  updateGuild: async (id, patch) => {
    const { data } = await http.put(`/v1/guilds/${id}`, patch);
    return data.guild as Guild;
  },
  joinGuild: async (id) => {
    await http.post(`/v1/guilds/${id}/join`);
  },
  leaveGuild: async (id) => {
    await http.post(`/v1/guilds/${id}/leave`);
  },

  // ── Member ──
  listMembers: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/members`, { params: { page_size: 500 } });
    return (data.members ?? []).map(toMember);
  },
  inviteMember: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/members/invite`, req);
    return data.invitation;
  },

  // ── Wallet ──
  getWallet: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/wallet`);
    return toWallet(data.wallet ?? data ?? {});
  },
  listTransactions: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/wallet/transactions`);
    return (data.transactions ?? []).map(toTransaction);
  },
  deposit: async (guildId, amount) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/deposit`, { amount });
    return toTransaction(data.transaction);
  },
  withdraw: async (guildId, amount) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/withdraw`, { amount });
    return toTransaction(data.transaction);
  },
  transfer: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/transfer`, {
      recipient_id: req.recipientId,
      amount: req.amount,
    });
    return toTransaction(data.transaction);
  },
  listBackpack: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/backpack`);
    return (data.items ?? []).map(toBackpackItem);
  },
  withdrawBackpackItem: async (guildId, itemId) => {
    await http.post(`/v1/guilds/${guildId}/backpack/${itemId}/withdraw`);
  },

  // ── Auction ──
  listAuctions: async (guildId, filters) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/auctions`, { params: filters });
    return (data.auctions ?? []).map(toAuctionItem);
  },
  getAuction: async (guildId, id) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/auctions/${id}`);
    const auction = toAuctionItem(data.auction);
    // Fetch bid history in parallel to hydrate the detail view
    try {
      const { data: bidData } = await http.get(`/v1/guilds/${guildId}/auctions/${id}/bids`);
      auction.bidHistory = (bidData.bids ?? []).map(toBid);
    } catch { /* ignore bid history failures — detail still usable */ }
    return auction;
  },
  createAuction: async (guildId, req) => {
    const payload = {
      guild_id: guildId,
      item: {
        name: req.name,
        description: req.description,
        category: req.category,
        rarity: req.rarity,
        image_url: req.imageUrl,
      },
      starting_bid: req.startingBid,
      min_bid_increment: req.minBidIncrement,
      duration_hours: req.duration,
      status: 'ACTIVE',
    };
    const { data } = await http.post(`/v1/guilds/${guildId}/auctions`, payload);
    return toAuctionItem(data.auction);
  },
  placeBid: async (guildId, auctionId, amount) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/auctions/${auctionId}/bids`, { amount });
    return { auction: toAuctionItem(data.auction), bid: toBid(data.bid) };
  },
  getBidHistory: async (guildId, auctionId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/auctions/${auctionId}/bids`);
    return (data.bids ?? []).map(toBid);
  },
  cancelAuction: async (guildId, id, reason) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/auctions/${id}/cancel`, { reason });
    return toAuctionItem(data.auction);
  },

  // ── CheckIn ──
  listCheckins: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/checkins`);
    return (data.checkins ?? []).map((c: Parameters<typeof toCheckin>[0]) => toCheckin(c));
  },
  getCheckin: async (guildId, id) => {
    const [{ data: detailData }, { data: attendeeData }] = await Promise.all([
      http.get(`/v1/guilds/${guildId}/checkins/${id}`),
      http
        .get(`/v1/guilds/${guildId}/checkins/${id}/attendees`)
        .catch(() => ({ data: { attendees: [] } })),
    ]);
    const attendees = (attendeeData.attendees ?? []).map(toAttendee);
    return toCheckin(detailData.checkin, attendees);
  },
  createCheckin: async (guildId, req) => {
    const payload = {
      title: req.title,
      description: req.description,
      datetime: req.datetime,
      expire_time: req.expireTime,
      image_url: req.imageUrl,
      loot_list: (req.lootList ?? []).map(i => ({ name: i.name })),
    };
    const { data } = await http.post(`/v1/guilds/${guildId}/checkins`, payload);
    return toCheckin(data.checkin);
  },
  updateCheckin: async (guildId, id, patch) => {
    const payload = {
      title: patch.title,
      description: patch.description,
      datetime: patch.datetime,
      expire_time: patch.expireTime,
      image_url: patch.imageUrl,
      loot_list: patch.lootList?.map(i => ({ name: i.name })),
    };
    const { data } = await http.patch(`/v1/guilds/${guildId}/checkins/${id}`, payload);
    return toCheckin(data.checkin);
  },
  deleteCheckin: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/checkins/${id}`);
  },
  submitAttendance: async (guildId, checkinId) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/checkins/${checkinId}/attend`);
    return toAttendee(data.attendee);
  },
  listAttendees: async (guildId, checkinId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/checkins/${checkinId}/attendees`);
    return (data.attendees ?? []).map(toAttendee);
  },

  // ── Lottery ──
  listLotteries: async (guildId, status) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/lotteries`, {
      params: status && status !== 'all' ? { status } : {},
    });
    return (data.lotteries ?? []).map(toLottery);
  },
  getLottery: async (guildId, id) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/lotteries/${id}`);
    return toLottery(data.lottery);
  },
  createLottery: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/lotteries`, {
      title: req.title,
      description: req.description,
      ticket_price: req.ticketPrice,
      max_tickets: req.maxTickets ?? 0,
      max_tickets_per_user: req.maxTicketsPerUser ?? 0,
      draw_date: req.drawDate,
      prizes: req.prizes,
    });
    return toLottery(data.lottery);
  },
  updateLottery: async (guildId, lotteryId, patch) => {
    const { data } = await http.patch(`/v1/guilds/${guildId}/lotteries/${lotteryId}`, {
      draw_date: patch.drawDate,
    });
    return toLottery(data.lottery);
  },
  purchaseTickets: async (guildId, lotteryId, quantity) => {
    const { data } = await http.post(
      `/v1/guilds/${guildId}/lotteries/${lotteryId}/tickets`,
      { quantity },
    );
    return (data.tickets ?? []).map(toLotteryTicket);
  },
  getLotteryWinners: async (guildId, lotteryId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/lotteries/${lotteryId}/winners`);
    return (data.winners ?? []).map(toLotteryWinner);
  },
  listMyTickets: async () => {
    const { data } = await http.get('/v1/me/lottery-tickets');
    return (data.tickets ?? []).map(toLotteryTicket);
  },

  // ── Bank ──
  getGuildBank: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/bank`);
    return toGuildBank(data.bank);
  },
  contributeFunds: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/contribute`, req);
    return toBankContribution(data.contribution);
  },
  requestFunds: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/request-funds`, req);
    return toFundRequest(data.fund_request);
  },
  reviewFundRequest: async (guildId, reqId, status, note) => {
    const { data } = await http.patch(
      `/v1/guilds/${guildId}/bank/fund-requests/${reqId}`,
      { status, note },
    );
    return toFundRequest(data.fund_request);
  },
  listFundRequests: async (guildId, status) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/bank/fund-requests`, {
      params: { status, page_size: 100 },
    });
    return (data.requests ?? []).map(toFundRequest);
  },
  listContributions: async (guildId) => {
    const [contrib, requests, itemRequests] = await Promise.all([
      http.get(`/v1/guilds/${guildId}/bank/contributions`),
      http.get(`/v1/guilds/${guildId}/bank/fund-requests`).catch(() => ({ data: { requests: [] } })),
      http.get(`/v1/guilds/${guildId}/bank/item-requests`).catch(() => ({ data: { requests: [] } })),
    ]);
    return toGuildContributions(
      (contrib.data.contributions ?? []).map(toBankContribution),
      (requests.data.requests ?? []).map(toFundRequest),
      (itemRequests.data.requests ?? []).map(toItemRequest),
    );
  },
  donateItem: async (guildId, backpackItemId, note) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/items`, {
      backpack_item_id: backpackItemId,
      note,
    });
    return toGuildBankItem(data.bank_item);
  },
  listBankItems: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/bank/items`);
    return (data.items ?? []).map(toGuildBankItem);
  },
  requestItem: async (guildId, bankItemId, reason) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/item-requests`, {
      bank_item_id: bankItemId,
      reason,
    });
    return toItemRequest(data.item_request);
  },
  reviewItemRequest: async (guildId, reqId, status, note) => {
    const { data } = await http.patch(
      `/v1/guilds/${guildId}/bank/item-requests/${reqId}`,
      { status, note },
    );
    return toItemRequest(data.item_request);
  },
  listItemRequests: async (guildId, status) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/bank/item-requests`, {
      params: { status, page_size: 100 },
    });
    return (data.requests ?? []).map(toItemRequest);
  },

  // ── Event / Calendar ──
  listEvents: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/events`);
    return (data.events ?? []).map(toGuildEvent);
  },
  getEvent: async (guildId, id) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/events/${id}`);
    return toGuildEvent(data.event);
  },
  createEvent: async (guildId, data) => {
    const { data: res } = await http.post(`/v1/guilds/${guildId}/events`, data);
    return toGuildEvent(res.event);
  },
  updateEvent: async (guildId, id, data) => {
    const { data: res } = await http.patch(`/v1/guilds/${guildId}/events/${id}`, data);
    return toGuildEvent(res.event);
  },
  deleteEvent: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/events/${id}`);
  },

  // ── Admin ──
  // These don't have dedicated backend endpoints yet — return empty/stub responses.
  getAdminActivity: async () => [],
  getAdminAnnouncements: async (): Promise<AdminAnnouncement[]> => [],
  createAnnouncement: notImpl('createAnnouncement'),
};
