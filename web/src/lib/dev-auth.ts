import { env } from '@/lib/env';

export const DEV_SESSION_COOKIE = 'guma_dev_user';

export interface DevUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

interface DevUserWire {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
}

function toDevUser(u: DevUserWire): DevUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
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

export async function listDevUsers(): Promise<DevUser[]> {
  const { users } = await devRequest<{ users: DevUserWire[] }>('/users');
  return users.map(toDevUser);
}

export async function createDevUser(displayName: string, login: boolean): Promise<DevUser> {
  const { user } = await devRequest<{ user: DevUserWire }>('/users', {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName, login }),
  });
  return toDevUser(user);
}

export async function devLoginAs(userId: string): Promise<DevUser> {
  const { user } = await devRequest<{ user: DevUserWire }>('/login', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  return toDevUser(user);
}

export async function devLogout(): Promise<void> {
  await devRequest<void>('/logout', { method: 'POST' });
}
