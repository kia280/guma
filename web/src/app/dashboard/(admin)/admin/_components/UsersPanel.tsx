'use client';

import { Button, Card, SearchField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import { MemberAssetsModal } from '@/components/MemberAssetsModal';
import type { useAdminData } from '../_hooks/useAdminData';
import type { MemberTableState } from '../_hooks/useMemberTable';
import { MembersTable } from './MembersTable';

type UsersPanelProps = {
  data: ReturnType<typeof useAdminData>;
  table: MemberTableState;
  canManageAssets: boolean;
};

export function UsersPanel({ data, table, canManageAssets }: UsersPanelProps) {
  const t = useTranslations('adminPage');
  const { members } = data;
  const assetsModalState = useOverlayState();
  const [assetsMemberId, setAssetsMemberId] = React.useState<string | null>(null);
  const assetsMember = React.useMemo(
    () => members.find(candidate => candidate.id === assetsMemberId) ?? null,
    [members, assetsMemberId],
  );

  const openMemberAssets = (memberId: React.Key) => {
    const member = members.find(candidate => candidate.id === memberId);
    if (!member) return;
    setAssetsMemberId(member.id);
    assetsModalState.open();
  };

  return (
    <>
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Content className="p-0">
          <AsyncContent
            state={data.usersState}
            onRetry={data.reload}
            skeleton={<div className="p-4"><ListSkeleton rows={5} /></div>}
          >
            {members.length === 0 ? (
              <EmptyContent icon="solar:users-group-rounded-linear" title={t('noUsers')} />
            ) : (
              <>
                <div className="flex flex-col gap-2 border-b border-divider p-3 sm:flex-row sm:items-center sm:justify-between">
                  <SearchField
                    aria-label={t('searchMembers')}
                    value={table.query}
                    onChange={table.setQuery}
                    variant="secondary"
                    className="w-full sm:max-w-xs"
                  >
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input placeholder={t('searchMembers')} />
                      <SearchField.ClearButton />
                    </SearchField.Group>
                  </SearchField>
                  <p role="status" className="type-caption text-hint tabular-nums">
                    {t('memberCount', { shown: table.filteredMembers.length, total: members.length })}
                  </p>
                </div>
                {table.filteredMembers.length === 0 ? (
                  <EmptyContent icon="solar:magnifer-linear" title={t('noMatchingMembers')} />
                ) : (
                  <MembersTable
                    table={table}
                    memberAssets={data.memberAssets}
                    assetsStatus={data.assetsStatus}
                    canManageAssets={canManageAssets}
                    onOpenMember={openMemberAssets}
                  />
                )}
              </>
            )}
          </AsyncContent>
          {canManageAssets && data.assetsStatus === 'error' && members.length > 0 && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-t border-divider p-4">
              <p className="type-body text-subtle">{t('assetsLoadError')}</p>
              <Button size="sm" variant="secondary" onPress={data.refetchAssets}>
                <Icon icon="solar:restart-linear" width={16} aria-hidden />
                {t('retry')}
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>
      {canManageAssets && (
        <MemberAssetsModal
          state={assetsModalState}
          member={assetsMember}
          members={members}
          onTransferred={data.refetchAssets}
          onRoleChanged={data.applyRoleChange}
          onMembersStale={data.refetchMembers}
        />
      )}
    </>
  );
}
