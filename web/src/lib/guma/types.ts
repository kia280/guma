// Single source of truth for all frontend ↔ backend data access methods.
// Both `gumaApiClient` (HTTP) and `mockApiClient` (in-memory) implement this
// interface — TypeScript enforces they stay in sync.

import type {
  AdminActivity,
  AdminAnnouncement,
  AdminGuildStats,
  AnnouncementDraftInput,
} from '@/types/admin';
import type { AuctionItem, Bid, CreateAuctionRequest, UpdateAuctionRequest } from '@/types/auction';
import type { BackpackItem } from '@/types/backpack';
import type { QueryOptions } from '@/types/common';
import type {
  DashboardData,
  Announcement,
  FeedEvent,
} from '@/types/dashboard';
import type { Guild } from '@/types/guild';
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
import type { ItemHistoryEvent } from '@/types/item';
import type {
  Lottery,
  LotteryTicket,
  LotteryWinner,
  CreateLotteryRequest,
  UpdateLotteryRequest,
} from '@/types/lottery';
import type { Invitation } from '@/types/member';
import type {
  GuildNotification,
  ListNotificationsOptions,
  NotificationPage,
} from '@/types/notification';
import type { NotificationPreferencesPatch, UserPreferences } from '@/types/preference';
import type {
  RollCall,
  RollCallGoldDistribution,
  RollCallGoldPayout,
  RollCallGoldSummary,
  Attendee,
  RollCallTemplate,
  RollCallTemplateInput,
  ItemTemplate,
  ItemTemplateInput,
  CreateRollCallRequest,
  LootEntry,
  UpdateRollCallRequest,
} from '@/types/roll-call';
import type { User, UserStats, BalancePoint, MockUser, UpdateMeRequest } from '@/types/user';
import type {
  AdminTransferFundsRequest,
  AdminTransferItemsRequest,
  MemberAssets,
  MemberAssetSummary,
  Transaction,
  TransferRequest,
  Wallet,
} from '@/types/wallet';

export interface AuctionFilters {
  status?: string;
  category?: string;
  rarity?: string;
  search?: string;
  pageSize?: number;
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
  getBalanceTrend(guildId: string, days?: number): Promise<BalancePoint[]>;

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
  updateMemberRole(guildId: string, userId: string, role: string): Promise<MockUser>;
  inviteMember(guildId: string, req: { email: string; role?: string }): Promise<Invitation>;

  // ── Wallet ──
  getWallet(guildId: string): Promise<Wallet>;
  listTransactions(guildId: string): Promise<Transaction[]>;
  deposit(guildId: string, amount: number): Promise<Transaction>;
  withdraw(guildId: string, amount: number): Promise<Transaction>;
  transfer(guildId: string, req: TransferRequest): Promise<Transaction>;
  listBackpack(guildId: string): Promise<BackpackItem[]>;
  withdrawBackpackItem(guildId: string, itemId: string): Promise<void>;
  cancelBackpackWithdrawal(guildId: string, itemId: string): Promise<void>;
  listPendingDeliveries(guildId: string): Promise<BackpackItem[]>;
  confirmBackpackDelivery(guildId: string, itemId: string): Promise<void>;
  transferBackpackItem(guildId: string, itemId: string, req: { recipientId: string; note?: string }): Promise<BackpackItem>;
  listMemberAssets(guildId: string): Promise<MemberAssetSummary[]>;
  getMemberAssets(guildId: string, userId: string): Promise<MemberAssets>;
  adminTransferFunds(guildId: string, userId: string, req: AdminTransferFundsRequest): Promise<number>;
  adminTransferItems(guildId: string, userId: string, req: AdminTransferItemsRequest): Promise<string[]>;

  // ── Auction ──
  listAuctions(guildId: string, filters?: AuctionFilters): Promise<AuctionItem[]>;
  getAuction(guildId: string, id: string): Promise<AuctionItem>;
  createAuction(guildId: string, req: CreateAuctionRequest): Promise<AuctionItem>;
  placeBid(guildId: string, auctionId: string, amount: number): Promise<{ auction: AuctionItem; bid: Bid }>;
  getBidHistory(guildId: string, auctionId: string): Promise<Bid[]>;
  updateAuction(guildId: string, id: string, patch: UpdateAuctionRequest): Promise<AuctionItem>;
  cancelAuction(guildId: string, id: string, reason?: string): Promise<AuctionItem>;
  deleteAuction(guildId: string, id: string): Promise<void>;

  // ── Roll calls ──
  listRollCalls(guildId: string): Promise<RollCall[]>;
  getRollCall(guildId: string, id: string): Promise<RollCall>;
  createRollCall(guildId: string, req: CreateRollCallRequest): Promise<RollCall>;
  updateRollCall(guildId: string, id: string, patch: UpdateRollCallRequest): Promise<RollCall>;
  deleteRollCall(guildId: string, id: string): Promise<void>;
  cancelRollCall(guildId: string, id: string): Promise<RollCall>;
  completeRollCall(guildId: string, id: string): Promise<RollCall>;
  updateRollCallLoot(guildId: string, id: string, lootList: LootEntry[]): Promise<RollCall>;
  checkIn(guildId: string, rollCallId: string, notes?: string): Promise<Attendee>;
  listAttendees(guildId: string, rollCallId: string): Promise<Attendee[]>;
  assignLoot(guildId: string, rollCallId: string, itemId: string, userId: string): Promise<void>;
  getRollCallGold(guildId: string, rollCallId: string): Promise<RollCallGoldSummary>;
  distributeRollCallGold(
    guildId: string,
    rollCallId: string,
    requestId: string,
    payouts: RollCallGoldPayout[],
  ): Promise<RollCallGoldDistribution>;
  listRollCallTemplates(guildId: string): Promise<RollCallTemplate[]>;
  createRollCallTemplate(guildId: string, input: RollCallTemplateInput): Promise<RollCallTemplate>;
  updateRollCallTemplate(guildId: string, id: string, input: RollCallTemplateInput): Promise<RollCallTemplate>;
  deleteRollCallTemplate(guildId: string, id: string): Promise<void>;
  listItemTemplates(guildId: string): Promise<ItemTemplate[]>;
  createItemTemplate(guildId: string, input: ItemTemplateInput): Promise<ItemTemplate>;
  updateItemTemplate(guildId: string, id: string, input: ItemTemplateInput): Promise<ItemTemplate>;
  deleteItemTemplate(guildId: string, id: string): Promise<void>;

  // ── Lottery ──
  listLotteries(guildId: string, status?: string): Promise<Lottery[]>;
  getLottery(guildId: string, id: string): Promise<Lottery>;
  createLottery(guildId: string, req: CreateLotteryRequest): Promise<Lottery>;
  updateLottery(guildId: string, lotteryId: string, patch: UpdateLotteryRequest): Promise<Lottery>;
  cancelLottery(guildId: string, lotteryId: string): Promise<Lottery>;
  deleteLottery(guildId: string, lotteryId: string): Promise<void>;
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
  listBankItems(guildId: string, options?: { rollCallId?: string }): Promise<GuildBankItem[]>;
  deleteBankItem(guildId: string, bankItemId: string): Promise<void>;
  requestItem(guildId: string, bankItemId: string, reason: string): Promise<ItemRequest>;
  reviewItemRequest(
    guildId: string,
    reqId: string,
    status: ReviewDecision,
    note?: string,
  ): Promise<ItemRequest>;
  listItemRequests(guildId: string, status?: RequestStatus): Promise<ItemRequest[]>;
  getItemHistory(guildId: string, itemId: string): Promise<ItemHistoryEvent[]>;

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

  // ── Preferences ──
  getMyPreferences(): Promise<UserPreferences>;
  updateNotificationPreferences(patch: NotificationPreferencesPatch): Promise<UserPreferences>;

  // ── Admin ──
  getAdminActivity(): Promise<AdminActivity[]>;
  getGuildStats(guildId: string): Promise<AdminGuildStats>;
  getAdminAnnouncements(guildId: string): Promise<AdminAnnouncement[]>;
  getAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  createAnnouncementDraft(guildId: string): Promise<AdminAnnouncement>;
  updateAnnouncement(guildId: string, id: string, input: AnnouncementDraftInput): Promise<AdminAnnouncement>;
  publishAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  unpublishAnnouncement(guildId: string, id: string): Promise<AdminAnnouncement>;
  deleteAnnouncementDraft(guildId: string, id: string): Promise<void>;
}
