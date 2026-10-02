'use client';

import { Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton, EmptyContent } from '@/components/AsyncContent';
import BackpackItemCard from '@/components/BackpackItemCard';
import { BackpackItemMoveModal, type BackpackMoveMode } from '@/components/BackpackItemMoveModal';
import { CreateAuctionModal, type AuctionDraftItem } from '@/components/CreateAuctionModal';
import { CreateRaffleModal, type RafflePrizeItem } from '@/components/CreateRaffleModal';
import { ItemHistoryModal } from '@/components/ItemHistoryModal';
import type { LoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { useGuildPermissions } from '@/lib/permissions';
import type { BackpackItem } from '@/types/backpack';
import type { MockUser } from '@/types/user';
import { useItemOverlay } from '../_hooks/useItemOverlay';
import { ItemWithdrawModal } from './ItemWithdrawModal';

const GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3';

type BackpackCardProps = {
  guildId: string;
  items: BackpackItem[];
  loadState: LoadState;
  members: MockUser[];
  onRetry: () => void;
  onItemsChanged: () => void;
  onItemWithdrawn: () => void;
};

export function BackpackCard({
  guildId,
  items,
  loadState,
  members,
  onRetry,
  onItemsChanged,
  onItemWithdrawn,
}: BackpackCardProps) {
  const t = useTranslations('walletPage');
  const notify = useToast();
  const { can } = useGuildPermissions();
  const highlightedSourceId = useSearchParams().get('source');
  const auction = useItemOverlay<AuctionDraftItem>();
  const raffle = useItemOverlay<RafflePrizeItem>();
  const move = useItemOverlay<{ mode: BackpackMoveMode; item: BackpackItem }>();
  const history = useItemOverlay<BackpackItem>();
  const withdraw = useItemOverlay<BackpackItem>();

  const openItemMove = (mode: BackpackMoveMode) => (item: BackpackItem) => move.open({ mode, item });

  const cancelItemWithdrawal = (item: BackpackItem) =>
    apiClient
      .cancelBackpackWithdrawal(guildId, item.id)
      .then(() => {
        notify.success(t('withdrawalCancelled', { name: item.item.name }));
        onItemsChanged();
      })
      .catch(() => notify.error(t('withdrawalCancelFailed')));

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <Icon className="text-accent" icon="solar:backpack-bold-duotone" width={20} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between type-body">
            <p className="type-subheading text-foreground">{t('yourItems')}</p>
            <Chip size="sm" variant="tertiary">
              {t('items', { count: items.length })}
            </Chip>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="pt-0">
        <AsyncContent
          state={loadState}
          onRetry={onRetry}
          skeleton={<CardGridSkeleton className={GRID_CLASS} cardClassName="h-16 rounded-xl" />}
        >
          {items.length === 0 ? (
            <EmptyContent icon="solar:backpack-linear" title={t('noItems')} description={t('noItemsHint')} />
          ) : (
            <div className={GRID_CLASS}>
              {items.map(item => (
                <BackpackItemCard
                  key={item.id}
                  item={item}
                  onPutToAuction={i =>
                    auction.open({
                      name: i.item.name,
                      description: i.item.description,
                      category: i.item.category,
                      rarity: i.item.rarity,
                      imageUrl: i.item.imageUrl,
                      source: { backpackItemId: i.id },
                    })
                  }
                  onPutToRaffle={
                    can('createRaffle')
                      ? i => raffle.open({ name: i.item.name, source: { backpackItemId: i.id } })
                      : undefined
                  }
                  onDonate={openItemMove('donate')}
                  onTransfer={openItemMove('transfer')}
                  onWithdraw={withdraw.open}
                  onCancelWithdrawal={cancelItemWithdrawal}
                  onShowHistory={history.open}
                  isHighlighted={Boolean(highlightedSourceId) && item.sourceId === highlightedSourceId}
                />
              ))}
            </div>
          )}
        </AsyncContent>
        <CreateAuctionModal state={auction.state} item={auction.item} onCreated={onItemsChanged} />
        <CreateRaffleModal state={raffle.state} prizeItem={raffle.item} onCreated={onItemsChanged} />
        <BackpackItemMoveModal
          state={move.state}
          mode={move.item?.mode ?? 'donate'}
          item={move.item?.item ?? null}
          members={members}
          onMoved={onItemsChanged}
        />
        <ItemHistoryModal
          state={history.state}
          itemId={history.item?.id ?? null}
          itemName={history.item?.item.name ?? ''}
        />
        <ItemWithdrawModal
          state={withdraw.state}
          guildId={guildId}
          item={withdraw.item}
          onCompleted={onItemWithdrawn}
        />
      </Card.Content>
    </Card>
  );
}
