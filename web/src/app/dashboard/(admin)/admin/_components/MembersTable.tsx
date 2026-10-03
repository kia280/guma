'use client';

import { Chip, Skeleton, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { UserAvatar } from '@/components/UserAvatar';
import { useUserName } from '@/hooks/useUserName';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { roleChipColor } from '@/lib/permissions';
import { userStatusColor, type UserStatus } from '@/lib/status-colors';
import type { MockUser } from '@/types/user';
import type { MemberAssetSummary } from '@/types/wallet';
import type { FetchStatus } from '../_hooks/useAdminData';
import { useIntlLocale } from '../_hooks/useIntlLocale';
import type { MemberTableState } from '../_hooks/useMemberTable';
import { ROLES, STATUSES, formatRelative } from '../_lib/format';

type MembersTableProps = {
  table: MemberTableState;
  memberAssets: Map<string, MemberAssetSummary>;
  assetsStatus: FetchStatus;
  canManageAssets: boolean;
  onOpenMember: (memberId: React.Key) => void;
};

export function MembersTable({ table, memberAssets, assetsStatus, canManageAssets, onOpenMember }: MembersTableProps) {
  const t = useTranslations('adminPage');
  const userName = useUserName();
  const formatGold = useFormatGold();
  const intlLocale = useIntlLocale();
  const formatCount = (value: number) => new Intl.NumberFormat(intlLocale).format(value);

  const formatLastActive = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())
      ? formatRelative(date, intlLocale)
      : value;
  };

  const roleLabel = (role?: string) =>
    role && ROLES.includes(role as (typeof ROLES)[number]) ? t(`roles.${role as (typeof ROLES)[number]}`) : role;

  const assetCell = (userId: string, render: (summary: MemberAssetSummary) => string) => {
    if (assetsStatus === 'loading') return <Skeleton className="h-5 w-16 rounded-lg" />;
    const summary = memberAssets.get(userId);
    return (
      <p className="type-body tabular-nums text-foreground">
        {summary ? render(summary) : <span className="text-hint" aria-label={t('assetsUnavailable')}>—</span>}
      </p>
    );
  };

  return (
    <Table variant="secondary">
      <Table.ScrollContainer>
        <Table.Content
          aria-label={t('usersTable')}
          sortDescriptor={table.sortDescriptor}
          onSortChange={table.setSortDescriptor}
          onRowAction={canManageAssets ? onOpenMember : undefined}
        >
          <Table.Header>
            <Table.Column id="user" allowsSorting isRowHeader>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('user')}</Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="role" allowsSorting className={canManageAssets ? 'hidden sm:table-cell' : 'max-md:rounded-r-2xl'}>
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('role')}</Table.SortableColumnHeader>
              )}
            </Table.Column>
            {canManageAssets && (
              <Table.Column id="gold" allowsSorting className="max-md:rounded-r-2xl">
                {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('gold')}</Table.SortableColumnHeader>
              )}
              </Table.Column>
            )}
            {canManageAssets && (
              <Table.Column id="items" allowsSorting className="hidden md:table-cell">
                {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('backpackItems')}</Table.SortableColumnHeader>
              )}
              </Table.Column>
            )}
            <Table.Column id="status" allowsSorting className="hidden md:table-cell">
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('status')}</Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="lastActive" allowsSorting className="hidden md:table-cell">
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>{t('lastActive')}</Table.SortableColumnHeader>
              )}
            </Table.Column>
          </Table.Header>
          <Table.Body>
            {table.filteredMembers.map((user: MockUser) => (
              <Table.Row key={user.id} id={user.id} className={canManageAssets ? 'group cursor-pointer' : 'group'}>
                <Table.Cell>
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={userName(user.username)} src={user.avatar} className="shrink-0 max-[359px]:hidden" />
                    <div className="min-w-0">
                      <p className="type-body font-medium text-foreground truncate">{userName(user.username)}</p>
                      {user.discordUsername && (
                        <p className="type-caption text-hint truncate flex items-center gap-1">
                          <Icon icon="ic:baseline-discord" width={14} className="shrink-0" aria-hidden />
                          <span className="sr-only">{t('discordUsername')}</span>
                          <span className="truncate">{user.discordUsername}</span>
                        </p>
                      )}
                      {canManageAssets && (
                        <Chip size="sm" color={roleChipColor(user.role)} variant="secondary" className="mt-1 capitalize whitespace-nowrap sm:hidden">
                          {roleLabel(user.role)}
                        </Chip>
                      )}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className={canManageAssets ? 'hidden sm:table-cell' : 'max-md:group-hover:rounded-r-2xl'}>
                  <Chip size="sm" color={roleChipColor(user.role)} variant="secondary" className="capitalize whitespace-nowrap">
                    {roleLabel(user.role)}
                  </Chip>
                </Table.Cell>
                {canManageAssets && (
                  <Table.Cell className="whitespace-nowrap tabular-nums max-md:group-hover:rounded-r-2xl">
                    {assetCell(user.id, summary => formatGold(summary.balance))}
                  </Table.Cell>
                )}
                {canManageAssets && (
                  <Table.Cell className="hidden md:table-cell">
                    {assetCell(user.id, summary => formatCount(summary.itemCount))}
                  </Table.Cell>
                )}
                <Table.Cell className="hidden md:table-cell">
                  <Chip
                    size="sm"
                    variant="secondary"
                    color={userStatusColor[user.status as UserStatus] ?? 'default'}
                    className="capitalize"
                  >
                    {user.status && STATUSES.includes(user.status as (typeof STATUSES)[number])
                      ? t(`statuses.${user.status as (typeof STATUSES)[number]}`)
                      : user.status}
                  </Chip>
                </Table.Cell>
                <Table.Cell className="hidden md:table-cell">
                  <p className="type-body text-subtle">{formatLastActive(user.lastActive)}</p>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
