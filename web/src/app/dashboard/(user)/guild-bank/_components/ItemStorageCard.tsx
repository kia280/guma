'use client';

import { Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton, EmptyContent } from '@/components/AsyncContent';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ItemHistoryModal } from '@/components/ItemHistoryModal';
import { useItemOverlay } from '@/hooks/useItemOverlay';
import type { LoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import type { GuildBankItem } from '@/types/guild-bank';
import { BankItemCard } from './BankItemCard';
import { ItemRequestModal } from './ItemRequestModal';

const GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3';

type ItemStorageCardProps = {
  guildId: string;
  items: GuildBankItem[];
  loadState: LoadState;
  onRetry: () => void;
  onChanged: () => void;
};

export function ItemStorageCard({ guildId, items, loadState, onRetry, onChanged }: ItemStorageCardProps) {
  const t = useTranslations('guildBankPage');
  const notify = useToast();
  const canDeleteItems = useGuildPermissions().can('deleteBankItem');
  const history = useItemOverlay<GuildBankItem>();
  const request = useItemOverlay<GuildBankItem>();
  const [itemToDelete, setItemToDelete] = React.useState<GuildBankItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [deleteFailedCode, setDeleteFailedCode] = React.useState<string | undefined>(undefined);

  const openItemDelete = (item: GuildBankItem) => {
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    try {
      await apiClient.deleteBankItem(guildId, itemToDelete.id);
    } catch (err) {
      const code = apiErrorCode(err);
      setDeleteFailedCode(code);
      if (code === GrpcCode.NotFound || code === GrpcCode.FailedPrecondition) onChanged();
      throw err;
    }
    onChanged();
    notify.success(t('deleteItemSuccess', { item: itemToDelete.name }));
  };

  const deleteFailedMessage = () => {
    switch (deleteFailedCode) {
      case GrpcCode.FailedPrecondition:
        return t('deleteItemLocked');
      case GrpcCode.NotFound:
        return t('errorItemUnavailable');
      case GrpcCode.PermissionDenied:
        return t('deleteItemNotAllowed');
      default:
        return t('deleteItemFailed');
    }
  };

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
          <Icon className="text-accent" icon="solar:box-bold-duotone" width={20} />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between type-body">
            <p className="type-subheading text-foreground">{t('storage')}</p>
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
            <EmptyContent icon="solar:box-linear" title={t('noItems')} description={t('noItemsHint')} />
          ) : (
            <div className={GRID_CLASS}>
              {items.map(item => (
                <BankItemCard
                  key={item.id}
                  item={item}
                  canDelete={canDeleteItems}
                  onRequest={request.open}
                  onDelete={openItemDelete}
                  onShowHistory={history.open}
                />
              ))}
            </div>
          )}
        </AsyncContent>
        <ItemHistoryModal state={history.state} itemId={history.item?.id ?? null} itemName={history.item?.name ?? ''} />
        <ConfirmDialog
          heading={t('deleteItemConfirmTitle', { item: itemToDelete?.name ?? '' })}
          body={t('deleteItemConfirmBody', { count: itemToDelete?.pendingRequestCount ?? 0 })}
          confirmLabel={t('deleteItemConfirm')}
          failedMessage={deleteFailedMessage()}
          isOpen={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          onConfirm={handleDeleteItem}
        />
        <ItemRequestModal
          state={request.state}
          guildId={guildId}
          item={request.item}
          onRequested={() => {
            onChanged();
            request.clear();
          }}
        />
      </Card.Content>
    </Card>
  );
}
