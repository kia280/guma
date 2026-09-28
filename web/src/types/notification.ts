export type NotificationKind =
  | 'fundRequestApproved'
  | 'fundRequestRejected'
  | 'itemRequestApproved'
  | 'itemRequestRejected'
  | 'fundRequestSubmitted'
  | 'itemRequestSubmitted'
  | 'auctionOutbid'
  | 'auctionWon'
  | 'auctionSold'
  | 'auctionUnsold'
  | 'auctionCancelled'
  | 'itemReceived'
  | 'itemDelivered'
  | 'lootAssigned'
  | 'checkinGoldReceived'
  | 'lotteryWon'
  | 'lotteryCancelled';

export type NotificationParams = Record<string, string | number>;

export interface GuildNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  params: NotificationParams;
  createdAt: string;
  isRead: boolean;
  href?: string;
}

export interface NotificationPage {
  notifications: GuildNotification[];
  nextPageToken?: string;
  totalCount: number;
  unreadCount: number;
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  pageSize?: number;
  pageToken?: string;
}
