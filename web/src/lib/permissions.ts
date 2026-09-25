'use client';

import React from 'react';
import { useUserStore } from '@/lib/store';

export const GUILD_ROLES = ['owner', 'admin', 'moderator', 'member'] as const;
export type GuildRole = (typeof GUILD_ROLES)[number];

const ALL: readonly GuildRole[] = GUILD_ROLES;
const OWNER_ADMIN: readonly GuildRole[] = ['owner', 'admin'];
const STAFF: readonly GuildRole[] = ['owner', 'admin', 'moderator'];

export const PERMISSION_SECTIONS = [
  {
    key: 'guild',
    icon: 'solar:users-group-rounded-bold-duotone',
    actions: [
      { key: 'viewGuild', roles: ALL },
      { key: 'viewMembers', roles: ALL },
      { key: 'editGuild', roles: OWNER_ADMIN },
      { key: 'deleteGuild', roles: ['owner'] as readonly GuildRole[] },
      { key: 'leaveGuild', roles: ['admin', 'moderator', 'member'] as readonly GuildRole[] },
    ],
  },
  {
    key: 'checkin',
    icon: 'solar:clipboard-check-bold-duotone',
    actions: [
      { key: 'attendCheckin', roles: ALL },
      { key: 'createCheckin', roles: STAFF },
    ],
  },
  {
    key: 'bank',
    icon: 'solar:safe-2-bold-duotone',
    actions: [
      { key: 'contribute', roles: ALL },
      { key: 'requestFromBank', roles: ALL },
      { key: 'reviewRequests', roles: STAFF },
    ],
  },
  {
    key: 'auction',
    icon: 'solar:sledgehammer-bold-duotone',
    actions: [
      { key: 'createAuction', roles: ALL },
      { key: 'placeBid', roles: ALL },
      { key: 'cancelAuction', roles: OWNER_ADMIN },
    ],
  },
  {
    key: 'lottery',
    icon: 'solar:ticket-bold-duotone',
    actions: [
      { key: 'buyTickets', roles: ALL },
      { key: 'createLottery', roles: OWNER_ADMIN },
      { key: 'drawLottery', roles: OWNER_ADMIN },
      { key: 'changeDrawDate', roles: OWNER_ADMIN },
    ],
  },
  {
    key: 'wallet',
    icon: 'solar:wallet-money-bold-duotone',
    actions: [{ key: 'manageWallet', roles: ALL }],
  },
] as const;

export type GuildAction =
  (typeof PERMISSION_SECTIONS)[number]['actions'][number]['key'] | 'accessAdmin';

type PermissionAction = { key: GuildAction; roles: readonly GuildRole[] };

const ACTION_ROLES: Record<GuildAction, readonly GuildRole[]> = {
  ...Object.fromEntries(
    (PERMISSION_SECTIONS as readonly { actions: readonly PermissionAction[] }[])
      .flatMap(section => section.actions)
      .map(action => [action.key, action.roles])
  ),
  accessAdmin: STAFF,
} as Record<GuildAction, readonly GuildRole[]>;

export const isGuildRole = (value: string | undefined | null): value is GuildRole =>
  (GUILD_ROLES as readonly string[]).includes(value ?? '');

export const roleCan = (role: string | undefined | null, action: GuildAction): boolean =>
  isGuildRole(role) && ACTION_ROLES[action].includes(role);

export interface GuildPermissions {
  role: GuildRole | null;
  isResolved: boolean;
  can: (action: GuildAction) => boolean;
}

export function useGuildPermissions(): GuildPermissions {
  const roleValue = useUserStore(state => state.user?.currentGuildRole);
  const status = useUserStore(state => state.status);
  const role = isGuildRole(roleValue) ? roleValue : null;
  const isResolved = status === 'ready' || status === 'error';
  const can = React.useCallback((action: GuildAction) => roleCan(role, action), [role]);
  return { role, isResolved, can };
}
