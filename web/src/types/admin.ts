// Admin panel types

export interface AdminActivity {
  id: string;
  actor: string;
  action: string;
  actionType: string;
  timestamp: string;
}

export interface AdminGuildStats {
  memberCount: number;
  bankBalance: number;
  bankCurrency: string;
  activeEventCount: number;
  bankItemCount: number;
}

export type AnnouncementStatus = 'draft' | 'published';

export interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  status: AnnouncementStatus;
  author: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface AnnouncementDraftInput {
  title: string;
  content: string;
  pinned: boolean;
}
