'use client';

import type { SortDescriptor } from '@heroui/react';
import { useLocale } from 'next-intl';
import React from 'react';
import { useUserName } from '@/hooks/useUserName';
import type { MockUser } from '@/types/user';
import type { MemberAssetSummary } from '@/types/wallet';
import { ROLE_RANK, timeValue } from '../_lib/format';

type MemberSortKey = 'user' | 'role' | 'gold' | 'items' | 'status' | 'lastActive';

export function useMemberTable(members: MockUser[], memberAssets: Map<string, MemberAssetSummary>) {
  const userName = useUserName();
  const locale = useLocale();
  const [sortDescriptor, setSortDescriptor] = React.useState<SortDescriptor | undefined>(undefined);
  const [query, setQuery] = React.useState('');

  const sortedMembers = React.useMemo(() => {
    if (!sortDescriptor?.column) return members;
    const column = sortDescriptor.column as MemberSortKey;
    const value = (user: MockUser): string | number => {
      switch (column) {
        case 'user':
          return userName(user.username);
        case 'role':
          return ROLE_RANK[user.role ?? ''] ?? ROLE_RANK.member + 1;
        case 'gold':
          return memberAssets.get(user.id)?.balance ?? -1;
        case 'items':
          return memberAssets.get(user.id)?.itemCount ?? -1;
        case 'status':
          return user.status === 'online' ? 0 : 1;
        case 'lastActive':
          return timeValue(user.lastActive);
      }
    };
    const direction = sortDescriptor.direction === 'descending' ? -1 : 1;
    return [...members].sort((a, b) => {
      const first = value(a);
      const second = value(b);
      const cmp =
        typeof first === 'string' && typeof second === 'string'
          ? first.localeCompare(second, locale)
          : Number(first) - Number(second);
      return cmp * direction;
    });
  }, [members, memberAssets, sortDescriptor, userName, locale]);

  const filteredMembers = React.useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return sortedMembers;
    return sortedMembers.filter(user =>
      [userName(user.username), user.discordUsername ?? ''].some(text =>
        text.toLocaleLowerCase(locale).includes(normalized),
      ),
    );
  }, [sortedMembers, query, locale, userName]);

  return { query, setQuery, sortDescriptor, setSortDescriptor, filteredMembers };
}

export type MemberTableState = ReturnType<typeof useMemberTable>;
