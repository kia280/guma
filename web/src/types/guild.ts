// Guild core types

export interface Guild {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  ownerId: string;
  memberCount: number;
  settings: GuildSettings;
  createdAt: string;
  updatedAt: string;
}

export interface GuildSettings {
  timezone: string;
  language: string;
  isPublic: boolean;
  currency: string;
  features: {
    economy: boolean;
    events: boolean;
    raids: boolean;
    voting: boolean;
  };
}

export interface GuildRole {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
  isDefault: boolean;
}
