// Single source of truth for all frontend ↔ backend data access methods.
// Both `gumaApiClient` (HTTP) and `mockApiClient` (in-memory) implement this
// interface — TypeScript enforces they stay in sync.

import type { QueryOptions } from '@/types/common';
import type { User, UserStats, BalancePoint, MockUser, UpdateMeRequest } from '@/types/user';
import type { Guild } from '@/types/guild';
import type { Invitation } from '@/types/member';
import type { Wallet, Transaction, TransferRequest } from '@/types/wallet';
import type { BackpackItem } from '@/types/backpack';
import type { AuctionItem, Bid, CreateAuctionRequest } from '@/types/auction';
import type {
  CheckinEntry,
  AttendanceMember,
  CheckinTemplate,
  CheckinTemplateInput,
  ItemTemplate,
  ItemTemplateInput,
  CreateCheckinRequest,
  UpdateCheckinRequest,
} from '@/types/checkin';
import type {
  Lottery,
  LotteryTicket,
  LotteryWinner,
  CreateLotteryRequest,
  UpdateLotteryRequest,
} from '@/types/lottery';
import type {
  GuildBank,
  GuildContribution,
  GuildBankItem,
  BankContribution,
  FundRequest,
  ItemRequest,
  RequestStatus,
  ReviewDecision,
} from '@/types/guild-bank';
import type {
  GuildEvent,
  CreateEventData,
  UpdateEventData,
} from '@/types/guild-events';
import type {
  DashboardData,
  Announcement,
  FeedEvent,
} from '@/types/dashboard';
import type {
  GuildNotification,
  ListNotificationsOptions,
  NotificationPage,
} from '@/types/notification';
import type {
  AdminActivity,
  AdminAnnouncement,
  AnnouncementDraftInput,
} from '@/types/admin';

export interface AuctionFilters {
  status?: string;
  category?: string;
  rarity?: string;
  search?: string;
}

export interface ApiClient {
  // ── Dashboard / Guma ──
  getDashboardData(guildId: string): Promise<DashboardData>;
  getAnnouncements(guildId: string): Promise<Announcement[]>;
  getFeedEvents(): Promise<FeedEvent[]>;

  // ── User ──
  getMe(): Promise<User>;
  updateMe(patch: UpdateMeRequest): Promise<User>;
  getUser(id: string): Promise<User>;
  getUserStats(): Promise<UserStats>;
  getBalanceTrend(): Promise<BalancePoint[]>;

  // ── Guild ──
  listGuilds(query?: QueryOptions): Promise<Guild[]>;
  getGuild(id: string): Promise<Guild>;
  getCurrentGuild(): Promise<Guild | null>;
  createGuild(req: { name: string; description?: string }): Promise<Guild>;
  updateGuild(id: string, patch: Partial<Guild>): Promise<Guild>;
  uploadGuildLogo(id: string, image: Blob): Promise<Guild>;
  deleteGuildLogo(id: string): Promise<Guild>;
  joinGuild(id: string): Promise<void>;
  leaveGuild(id: string): Promise<void>;

  // ── Member ──
  listMembers(guildId: string): Promise<MockUser[]>;
  inviteMember(guildId: string, req: { email: string; role?: string }): Promise<Invitation>;

  // ── Wallet ──
  getWallet(guildId: string): Promise<Wallet>;
  listTransactions(guildId: string): Promise<Transaction[]>;
  deposit(guildId: string, amount: number): Promise<Transaction>;
  withdraw(guildId: string, amount: number): Promise<Transaction>;
  transfer(guildId: string, req: TransferRequest): Promise<Transaction>;
  listBackpack(guildId: string): Promise<BackpackItem[]>;
  withdrawBackpackItem(guildId: string, itemId: string): Promise<void>;

  // ── Auction ──
  listAuctions(guildId: string, filters?: AuctionFilters): Promise<AuctionItem[]>;
  getAuction(guildId: string, id: string): Promise<AuctionItem>;
  createAuction(guildId: string, req: CreateAuctionRequest): Promise<AuctionItem>;
  placeBid(guildId: string, auctionId: string, amount: number): Promise<{ auction: AuctionItem; bid: Bid }>;
  getBidHistory(guildId: string, auctionId: string): Promise<Bid[]>;
  cancelAuction(guildId: string, id: string, reason?: string): Promise<AuctionItem>;

  // ── CheckIn ──
  listCheckins(guildId: string): Promise<CheckinEntry[]>;
  getCheckin(guildId: string, id: string): Promise<CheckinEntry>;
  createCheckin(guildId: string, req: CreateCheckinRequest): Promise<CheckinEntry>;
  updateCheckin(guildId: string, id: string, patch: UpdateCheckinRequest): Promise<CheckinEntry>;
  deleteCheckin(guildId: string, id: string): Promise<void>;
  submitAttendance(guildId: string, checkinId: string): Promise<AttendanceMember>;
  listAttendees(guildId: string, checkinId: string): Promise<AttendanceMember[]>;
  listCheckinTemplates(guildId: string): Promise<CheckinTemplate[]>;
  createCheckinTemplate(guildId: string, input: CheckinTemplateInput): Promise<CheckinTemplate>;
  updateCheckinTemplate(guildId: string, id: string, input: CheckinTemplateInput): Promise<CheckinTemplate>;
  deleteCheckinTemplate(guildId: string, id: string): Promise<void>;
  listItemTemplates(guildId: string): Promise<ItemTemplate[]>;
  createItemTemplate(guildId: string, input: ItemTemplateInput): Promise<ItemTemplate>;
  updateItemTemplate(guildId: string, id: string, input: ItemTemplateInput): Promise<ItemTemplate>;
  deleteItemTemplate(guildId: string, id: string): Promise<void>;

  // ── Lottery ──
  listLotteries(guildId: string, status?: string): Promise<Lottery[]>;
  getLottery(guildId: string, id: string): Promise<Lottery>;
  createLottery(guildId: string, req: CreateLotteryRequest): Promise<Lottery>;
  updateLottery(guildId: string, lotteryId: string, patch: UpdateLotteryRequest): Promise<Lottery>;
  purchaseTickets(guildId: string, lotteryId: string, quantity: number): Promise<LotteryTicket[]>;
  getLotteryWinners(guildId: string, lotteryId: string): Promise<LotteryWinner[]>;
  listMyTickets(): Promise<LotteryTicket[]>;

  // ── Bank ──
  getGuildBank(guildId: string): Promise<GuildBank>;
  contributeFunds(guildId: string, req: { amount: number; note?: string }): Promise<BankContribution>;
  requestFunds(guildId: string, req: { amount: number; reason: string }): Promise<FundRequest>;
  reviewFundRequest(
    guildId: string,
    reqId: string,
    status: ReviewDecision,
    note?: string,
  ): Promise<FundRequest>;
  listFundRequests(guildId: string, status?: RequestStatus): Promise<FundRequest[]>;
  listContributions(guildId: string): Promise<GuildContribution[]>;
  donateItem(guildId: string, backpackItemId: string, note?: string): Promise<GuildBankItem>;
  listBankItems(guildId: string): Promise<GuildBankItem[]>;
  requestItem(guildId: string, bankItemId: string, reason: string): Promise<ItemRequest>;
  reviewItemRequest(
    guildId: string,
    reqId: string,
    status: ReviewDecision,
    note?: string,
  ): Promise<ItemRequest>;
  listItemRequests(guildId: string, status?: RequestStatus): Promise<ItemRequest[]>;

  // ── Event / Calendar ──
  listEvents(guildId: string): Promise<GuildEvent[]>;
  getEvent(guildId: string, id: string): Promise<GuildEvent>;
  createEvent(guildId: string, data: CreateEventData): Promise<GuildEvent>;
  updateEvent(guildId: string, id: string, data: UpdateEventData): Promise<GuildEvent>;
  deleteEvent(guildId: string, id: string): Promise<void>;

  // ── Notifications ──
  listNotifications(options?: ListNotificationsOptions): Promise<NotificationPage>;
  getUnreadNotificationCount(): Promise<number>;
  markNotificationRead(id: string): Promise<GuildNotification>;
  markAllNotificationsRead(): Promise<number>;

  // ── Admin ──
  getAdminActivity(): Promise<AdminActivity[]>;
  getAdminAnnouncements(guildId: string): Promise<AdminAnnouncement[]>;
  getAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  createAnnouncementDraft(guildId: string): Promise<AdminAnnouncement>;
  updateAnnouncement(guildId: string, id: string, input: AnnouncementDraftInput): Promise<AdminAnnouncement>;
  publishAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  unpublishAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  deleteAnnouncementDraft(guildId: string, id: string): Promise<void>;
}
