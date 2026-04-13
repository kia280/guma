// Guild member and invitation types

import type { User } from './user';
import type { GuildRole } from './guild';

export interface GuildMember {
  id: string;
  userId: string;
  guildId: string;
  user: User;
  nickname?: string;
  roles: GuildRole[];
  joinedAt: string;
  isActive: boolean;
}

export interface Invitation {
  id: string;
  guildId: string;
  code: string;
  inviterId: string;
  email?: string;
  role?: string;
  expiresAt?: string;
  createdAt: string;
}
