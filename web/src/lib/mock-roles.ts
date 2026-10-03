import type { GuildRole } from '@/lib/permissions';

export const DEV_MOCK_ROLES = ['owner', 'admin', 'moderator', 'member'] as const satisfies readonly GuildRole[];
export type DevMockRole = (typeof DEV_MOCK_ROLES)[number];
