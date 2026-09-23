// User, auth, and stats types

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio: string;
  guildIds: string[];
  currentGuildId: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

/** Simplified user for directory listings and recipient pickers. */
export interface MockUser {
  id: string;
  username: string;
  email: string;
  role?: string;
  status?: string;
  lastActive?: string;
  avatar?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  provider: 'discord' | 'oauth2';
  code?: string;
  redirectUri?: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface UserStats {
  balance: number;
  checkinsThisMonth: number;
  activeAuctions: number;
  activityPoints: number;
}

export interface BalancePoint {
  day: string;
  balance: number;
}
