export enum CheckinStatus {
  OPEN = 1,
  CLOSED = 2,
  FINISHED = 3,
}

export interface AttendanceMember {
  id: string;
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

export const mockCheckins: CheckinEntry[] = [
  {
    id: '1',
    status: CheckinStatus.OPEN,
    date: '2024/07/24 22:47',
    description: '蜘蛛',
    expireTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    attendanceList: [
      { id: 'a1', username: 'DragonHunter', checkedInAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      { id: 'a2', username: 'Warrior123', checkedInAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), notes: 'Late arrival' },
    ],
    lootList: [
      { id: 'l1', name: 'Dragon Scale', quantity: 3 },
      { id: 'l2', name: 'Fire Crystal', quantity: 1, winner: 'DragonHunter' },
    ],
  },
  {
    id: '2',
    status: CheckinStatus.OPEN,
    date: '2024/07/24 22:47',
    description: '蜘蛛',
    expireTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    attendanceList: [
      { id: 'a3', username: 'Healer', checkedInAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
    ],
    lootList: [
      { id: 'l3', name: 'Web Fragment', quantity: 5 },
    ],
  },
  {
    id: '3',
    status: CheckinStatus.FINISHED,
    date: '2024/07/24 22:47',
    description: '蜘蛛',
    expireTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    attendanceList: [
      { id: 'a4', username: 'DragonHunter', checkedInAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
      { id: 'a5', username: 'Warrior123', checkedInAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString() },
      { id: 'a6', username: 'Enchanter', checkedInAt: new Date(Date.now() - 2.8 * 60 * 60 * 1000).toISOString() },
    ],
    lootList: [
      { id: 'l4', name: 'Venom Fang', quantity: 2, winner: 'Warrior123' },
      { id: 'l5', name: 'Spider Silk', quantity: 10, winner: 'Enchanter' },
    ],
  },
  {
    id: '4',
    status: CheckinStatus.CLOSED,
    date: '2024/07/24 22:47',
    description: '蜘蛛',
    isDisabled: true,
    expireTime: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    attendanceList: [
      { id: 'a7', username: 'Blacksmith', checkedInAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
    ],
    lootList: [],
  },
];
