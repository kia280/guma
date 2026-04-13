// Admin panel types

export interface AdminActivity {
  id: string;
  actor: string;
  action: string;
  actionType: string;
  timestamp: string;
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  author: string;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  pinned?: boolean;
}
