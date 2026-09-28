import { env } from '@/lib/env';

export const DEV_SESSION_COOKIE = 'guma_dev_user';

const IDENTITY_CHANNEL = 'guma-dev-identity';

let identityChannel: BroadcastChannel | null | undefined;

function getIdentityChannel(): BroadcastChannel | null {
  if (identityChannel === undefined) {
    identityChannel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(IDENTITY_CHANNEL);
  }
  return identityChannel;
}

function announceIdentityChange(): void {
  getIdentityChannel()?.postMessage('changed');
}

export function onDevIdentityChange(listener: () => void): () => void {
  const channel = getIdentityChannel();
  if (!channel) return () => undefined;
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}

export interface DevUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  role?: string;
  createdAt: string;
}

export interface DevGuild {
  id: string;
  name: string;
}

export interface DevUserList {
  guild: DevGuild | null;
  users: DevUser[];
}

interface DevUserWire {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  role?: string;
  created_at: string;
}

function toDevUser(u: DevUserWire): DevUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    role: u.role,
    createdAt: u.created_at,
  };
}

async function devRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${env.api.url}/v1/dev${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function getDevSession(): Promise<DevUser | null> {
  const { user } = await devRequest<{ user: DevUserWire | null }>('/session');
  return user ? toDevUser(user) : null;
}

export async function listDevUsers(): Promise<DevUserList> {
  const { guild, users } = await devRequest<{ guild: DevGuild | null; users: DevUserWire[] }>('/users');
  return { guild, users: users.map(toDevUser) };
}

export async function seedDevMembers(count: number): Promise<DevUserList> {
  const { guild, users } = await devRequest<{ guild: DevGuild; users: DevUserWire[] }>('/seed', {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
  return { guild, users: users.map(toDevUser) };
}

export async function createDevUser(displayName: string, login: boolean): Promise<DevUser> {
  const { user } = await devRequest<{ user: DevUserWire }>('/users', {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName, login }),
  });
  if (login) announceIdentityChange();
  return toDevUser(user);
}

export async function devLoginAs(userId: string): Promise<DevUser> {
  const { user } = await devRequest<{ user: DevUserWire }>('/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  announceIdentityChange();
  return toDevUser(user);
}

export async function devLogout(): Promise<void> {
  await devRequest<void>('/logout', { method: 'POST' });
  announceIdentityChange();
}
