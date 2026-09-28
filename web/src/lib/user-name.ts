import type { User } from '@/types/user';

export const ownUserName = (user: Pick<User, 'displayName' | 'username'> | null | undefined): string =>
  user?.displayName || user?.username || '';
