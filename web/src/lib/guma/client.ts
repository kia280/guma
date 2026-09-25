// HTTP-backed implementation of ApiClient. Calls the guma grpc-gateway at
// `env.api.url` and translates proto-wire responses (snake_case, nested Item)
// into the UI shape via transforms.

import axios, { AxiosError, AxiosInstance } from 'axios';
import { env } from '@/lib/env';
import { clearSession } from '@/lib/session';
import type { LootEntry } from '@/types/checkin';
import type { BalancePoint, UserStats } from '@/types/user';
import { fromMinorUnits, toMinorUnits } from './money';
import { toAdminAnnouncement, toAnnouncement, toAuctionItem, toAttendee, toBackpackItem, toBankContribution, toBid, toCheckin, toCheckinTemplate, toFundRequest, toGuild, toItemTemplate, toGuildBank, toGuildBankItem, toGuildContributions, toGuildEvent, toItemRequest, toLottery, toLotteryTicket, toLotteryWinner, toMember, toNotification, toNotificationPage, toTransaction, toUser, toUserPreferences, toWallet } from './transforms';
import type { ApiClient } from './types';

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

const toProtoLoot = (entry: LootEntry) => ({
  name: entry.name,
  description: entry.description,
  category: entry.category,
  rarity: entry.rarity,
});

const apiGuild = (g: Parameters<typeof toGuild>[0]) => toGuild(g, env.api.url);

const fileToBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
    reader.readAsDataURL(file);
  });

export const gumaApiClient: ApiClient = {
  // ── Dashboard / Guma ──
  getDashboardData: async (guildId) => {
    const [{ data }, announcements] = await Promise.all([
      http.get(`/v1/dashboard/${guildId}`),
      gumaApiClient.getAnnouncements(guildId).catch(() => []),
    ]);
    return {
      guildStats: data.guild_stats ?? {
        members: 0, activeEvents: 0, balance: 0, checkinsThisWeek: 0, activeAuctions: 0, openLotteries: 0,
      },
      personalStats: data.personal_stats ?? {
        balance: 0, checkinsThisMonth: 0, activeAuctions: 0, activityPoints: 0,
      },
      balanceTrend: data.balance_trend ?? [],
      incomingEvents: data.incoming_events ?? [],
      announcements,
    };
  },
  getAnnouncements: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/announcements`);
    return (data.announcements ?? []).map(toAnnouncement);
  },
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
    return (data.points ?? []).map((point: BalancePoint) => ({ ...point, balance: fromMinorUnits(point.balance) }));
  },

  // ── Guild ──
  listGuilds: async (query = {}) => {
    const { data } = await http.get('/v1/guilds', {
      params: {
        search: query.search || undefined,
        page_size: query.limit,
      },
    });
    return (data.guilds ?? []).map(apiGuild);
  },
  getGuild: async (id) => {
    const { data } = await http.get(`/v1/guilds/${id}`);
    return apiGuild(data.guild ?? {});
  },
  getCurrentGuild: async () => {
    try {
      const { data } = await http.get('/v1/guilds/current');
      return data.guild ? apiGuild(data.guild) : null;
    } catch {
      return null;
    }
  },
  createGuild: async (req) => {
    const { data } = await http.post('/v1/guilds', req);
    return apiGuild(data.guild ?? {});
  },
  updateGuild: async (id, patch) => {
    const { data } = await http.put(`/v1/guilds/${id}`, patch);
    return apiGuild(data.guild ?? {});
  },
  uploadGuildLogo: async (id, image) => {
    const { data } = await http.put(`/v1/guilds/${id}/logo`, {
      data: await fileToBase64(image),
      content_type: image.type,
    });
    return apiGuild(data.guild ?? {});
  },
  deleteGuildLogo: async (id) => {
    const { data } = await http.delete(`/v1/guilds/${id}/logo`);
    return apiGuild(data.guild ?? {});
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
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/deposit`, { amount: toMinorUnits(amount) });
    return toTransaction(data.transaction);
  },
  withdraw: async (guildId, amount) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/withdraw`, { amount: toMinorUnits(amount) });
    return toTransaction(data.transaction);
  },
  transfer: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/wallet/transfer`, {
      to_user_id: req.recipientId,
      amount: toMinorUnits(req.amount),
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
      starting_bid: toMinorUnits(req.startingBid),
      min_bid_increment: toMinorUnits(req.minBidIncrement),
      duration_hours: req.duration,
      status: 'ACTIVE',
    };
    const { data } = await http.post(`/v1/guilds/${guildId}/auctions`, payload);
    return toAuctionItem(data.auction);
  },
  placeBid: async (guildId, auctionId, amount) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/auctions/${auctionId}/bids`, { amount: toMinorUnits(amount) });
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
      loot_list: (req.lootList ?? []).map(toProtoLoot),
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
      loot_list: patch.lootList?.map(toProtoLoot),
    };
    const { data } = await http.patch(`/v1/guilds/${guildId}/checkins/${id}`, payload);
    return toCheckin(data.checkin);
  },
  deleteCheckin: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/checkins/${id}`);
  },
  listCheckinTemplates: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/checkin-templates`);
    return (data.templates ?? []).map(toCheckinTemplate);
  },
  createCheckinTemplate: async (guildId, input) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/checkin-templates`, {
      name: input.name,
      title: input.title,
      item_template_ids: input.itemTemplateIds,
    });
    return toCheckinTemplate(data.template);
  },
  updateCheckinTemplate: async (guildId, id, input) => {
    const { data } = await http.patch(`/v1/guilds/${guildId}/checkin-templates/${id}`, {
      name: input.name,
      title: input.title,
      item_template_ids: input.itemTemplateIds,
    });
    return toCheckinTemplate(data.template);
  },
  deleteCheckinTemplate: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/checkin-templates/${id}`);
  },
  listItemTemplates: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/item-templates`);
    return (data.templates ?? []).map(toItemTemplate);
  },
  createItemTemplate: async (guildId, input) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/item-templates`, input);
    return toItemTemplate(data.template);
  },
  updateItemTemplate: async (guildId, id, input) => {
    const { data } = await http.patch(`/v1/guilds/${guildId}/item-templates/${id}`, input);
    return toItemTemplate(data.template);
  },
  deleteItemTemplate: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/item-templates/${id}`);
  },
  submitAttendance: async (guildId, checkinId, notes) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/checkins/${checkinId}/attend`, { notes: notes ?? '' });
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
      ticket_price: toMinorUnits(req.ticketPrice),
      max_tickets: req.maxTickets ?? 0,
      max_tickets_per_user: req.maxTicketsPerUser ?? 0,
      draw_date: req.drawDate,
      prizes: req.prizes?.map(prize => ({ ...prize, amount: toMinorUnits(prize.amount ?? 0) })),
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
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/contribute`, { ...req, amount: toMinorUnits(req.amount) });
    return toBankContribution(data.contribution);
  },
  requestFunds: async (guildId, req) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/bank/request-funds`, { ...req, amount: toMinorUnits(req.amount) });
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

  // ── Notifications ──
  listNotifications: async (options = {}) => {
    const { data } = await http.get('/v1/me/notifications', {
      params: {
        unread_only: options.unreadOnly || undefined,
        page_size: options.pageSize,
        page_token: options.pageToken,
      },
    });
    return toNotificationPage(data);
  },
  getUnreadNotificationCount: async () => {
    const { data } = await http.get('/v1/me/notifications/unread-count');
    return Number(data.unread_count ?? 0);
  },
  markNotificationRead: async (id) => {
    const { data } = await http.post(`/v1/me/notifications/${id}/read`, {});
    return toNotification(data.notification);
  },
  markAllNotificationsRead: async () => {
    const { data } = await http.post('/v1/me/notifications/read-all', {});
    return Number(data.updated_count ?? 0);
  },

  // ── Preferences ──
  getMyPreferences: async () => {
    const { data } = await http.get('/v1/me/preferences');
    return toUserPreferences(data);
  },
  updateNotificationPreferences: async (patch) => {
    const { data } = await http.patch('/v1/me/preferences', {
      notifications: {
        email_notifications: patch.emailNotifications,
        auction_alerts: patch.auctionAlerts,
        lottery_alerts: patch.lotteryAlerts,
        event_reminders: patch.eventReminders,
        checkin_reminders: patch.checkinReminders,
      },
    });
    return toUserPreferences(data);
  },

  // ── Admin ──
  getAdminActivity: async () => [],
  getAdminAnnouncements: async (guildId) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/announcements`, {
      params: { include_drafts: true },
    });
    return (data.announcements ?? []).map(toAdminAnnouncement);
  },
  getAnnouncement: async (guildId, id) => {
    const { data } = await http.get(`/v1/guilds/${guildId}/announcements/${id}`);
    return toAdminAnnouncement(data.announcement);
  },
  createAnnouncementDraft: async (guildId) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/announcements`, {});
    return toAdminAnnouncement(data.announcement);
  },
  updateAnnouncement: async (guildId, id, input) => {
    const { data } = await http.patch(`/v1/guilds/${guildId}/announcements/${id}`, input);
    return toAdminAnnouncement(data.announcement);
  },
  publishAnnouncement: async (guildId, id) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/announcements/${id}/publish`, {});
    return toAdminAnnouncement(data.announcement);
  },
  unpublishAnnouncement: async (guildId, id) => {
    const { data } = await http.post(`/v1/guilds/${guildId}/announcements/${id}/unpublish`, {});
    return toAdminAnnouncement(data.announcement);
  },
  deleteAnnouncementDraft: async (guildId, id) => {
    await http.delete(`/v1/guilds/${guildId}/announcements/${id}`);
  },
};
