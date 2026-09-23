export type NotificationKind =
  | 'tradeOffer'
  | 'transferReceived'
  | 'attendanceSettled'
  | 'lootWon'
  | 'auctionOutbid'
  | 'auctionWon'
  | 'lotteryWon'
  | 'bankRequestApproved';

export type TradeResponse = 'accepted' | 'declined';

export interface GuildNotification {
  id: string;
  kind: NotificationKind;
  params: Record<string, string | number>;
  createdAt: string;
  isRead: boolean;
  href?: string;
  response?: TradeResponse;
}
