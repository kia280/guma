import type { User } from '@/types/user';

export const ownUserName = (user: Pick<User, 'displayName'> | null | undefined): string => user?.displayName ?? '';
