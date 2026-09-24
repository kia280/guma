// Check-in event types

export enum CheckinStatus {
  OPEN = 1,
  CLOSED = 2,
  FINISHED = 3,
}

export interface AttendanceMember {
  id: string;
  userId?: string;
  username: string;
  checkedInAt: string;
  notes?: string;
}

export interface LootItem {
  id: string;
  name: string;
  quantity?: number;
  winner?: string;
}

export interface CheckinEntry {
  id: string;
  status: CheckinStatus;
  date: string;
  description: string;
  expireTime?: string;
  attendanceList: AttendanceMember[];
  lootList: LootItem[];
  isDisabled?: boolean;
  imageUrl?: string;
}

export interface CreateCheckinRequest {
  title: string;
  description?: string;
  datetime?: string;
  expireTime?: string;
  imageUrl?: string;
  lootList?: Array<{ name: string; quantity?: number }>;
}

export interface UpdateCheckinRequest extends Partial<CreateCheckinRequest> {}

export interface CheckinTemplate {
  id: string;
  name: string;
  title: string;
  lootList: LootItem[];
}

export interface CheckinTemplateInput {
  name: string;
  title: string;
  lootList: Array<{ name: string }>;
}
