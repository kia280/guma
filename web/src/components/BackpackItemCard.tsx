'use client';

import { Chip, Dropdown } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { BackpackItem } from '@/types/backpack';
import { ItemCard, ItemCardAction } from './ItemCard';
import { ItemLockChip } from './ItemLockChip';

const SOURCE_ICONS: Record<BackpackItem['acquiredFrom'], string> = {
  auction: 'solar:sledgehammer-linear',
  lottery: 'solar:ticket-linear',
  transfer: 'solar:users-group-rounded-linear',
  bank: 'solar:safe-2-linear',
  rollCall: 'solar:clipboard-check-linear',
  admin: 'solar:shield-user-linear',
};

const sourceHref = (item: BackpackItem): string | undefined => {
  if (!item.sourceId) return undefined;
  switch (item.acquiredFrom) {
    case 'auction':
      return `/dashboard/auction/${item.sourceId}`;
    case 'lottery':
      return `/dashboard/lottery/${item.sourceId}`;
    case 'rollCall':
      return `/dashboard/roll-calls/${item.sourceId}`;
    case 'bank':
      return `/dashboard/guild-bank?request=${item.sourceId}`;
    default:
      return undefined;
  }
};

interface BackpackItemCardProps {
  item: BackpackItem;
  onPutToAuction?: (item: BackpackItem) => void;
  onPutToLottery?: (item: BackpackItem) => void;
  onDonate?: (item: BackpackItem) => void;
  onTransfer?: (item: BackpackItem) => void;
  onWithdraw?: (item: BackpackItem) => void;
  onShowHistory?: (item: BackpackItem) => void;
  onCancelWithdrawal?: (item: BackpackItem) => void;
  isHighlighted?: boolean;
}

const BackpackItemCard = ({
  item,
  onPutToAuction,
  onPutToLottery,
  onDonate,
  onTransfer,
  onWithdraw,
  onShowHistory,
  onCancelWithdrawal,
  isHighlighted = false,
}: BackpackItemCardProps) => {
  const t = useTranslations('backpackItemCard');
  const cardRef = React.useRef<HTMLDivElement>(null);
  const isAwaitingDelivery = Boolean(item.deliveryRequestedAt);
  const sourceText = item.sourceLabel
    ? t(`sourceWithLabel.${item.acquiredFrom}`, { label: item.sourceLabel })
    : t(`acquiredFrom.${item.acquiredFrom}`);

  React.useEffect(() => {
    if (isHighlighted) cardRef.current?.scrollIntoView({ block: 'center' });
  }, [isHighlighted]);

  return (
    <ItemCard
      ref={cardRef}
      name={item.item.name}
      category={item.item.category}
      rarity={item.item.rarity}
      imageUrl={item.item.imageUrl}
      isHighlighted={isHighlighted}
      source={{ icon: SOURCE_ICONS[item.acquiredFrom], text: sourceText, href: sourceHref(item) }}
      chips={
        (item.lock || isAwaitingDelivery) && (
          <>
            {item.lock && <ItemLockChip lock={item.lock} />}
            {isAwaitingDelivery && (
              <Chip size="sm" color="warning" variant="secondary">
                {t('awaitingDelivery')}
              </Chip>
            )}
          </>
        )
      }
      actions={
        <Dropdown>
          <ItemCardAction aria-label={t('actions')}>
            <Icon icon="solar:menu-dots-bold" width={16} />
          </ItemCardAction>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label={t('actions')}
              disabledKeys={item.lock ? ['auction', 'lottery', 'donate', 'transfer', 'withdraw'] : []}
              onAction={key => {
                if (key === 'auction') onPutToAuction?.(item);
                if (key === 'lottery') onPutToLottery?.(item);
                if (key === 'donate') onDonate?.(item);
                if (key === 'transfer') onTransfer?.(item);
                if (key === 'withdraw') onWithdraw?.(item);
                if (key === 'history') onShowHistory?.(item);
                if (key === 'cancelWithdrawal') onCancelWithdrawal?.(item);
              }}
            >
              {isAwaitingDelivery && (
                <Dropdown.Item id="cancelWithdrawal" textValue={t('cancelWithdrawal')}>
                  <Icon icon="solar:undo-left-linear" width={16} />
                  <span>{t('cancelWithdrawal')}</span>
                </Dropdown.Item>
              )}
              {!isAwaitingDelivery && (
                <Dropdown.Item id="auction" textValue={t('putToAuction')}>
                  <Icon icon="solar:sledgehammer-linear" width={16} />
                  <span>{t('putToAuction')}</span>
                </Dropdown.Item>
              )}
              {!isAwaitingDelivery && onPutToLottery && (
                <Dropdown.Item id="lottery" textValue={t('putToLottery')}>
                  <Icon icon="solar:ticket-linear" width={16} />
                  <span>{t('putToLottery')}</span>
                </Dropdown.Item>
              )}
              {!isAwaitingDelivery && onDonate && (
                <Dropdown.Item id="donate" textValue={t('donate')}>
                  <Icon icon="solar:safe-2-linear" width={16} />
                  <span>{t('donate')}</span>
                </Dropdown.Item>
              )}
              {!isAwaitingDelivery && onTransfer && (
                <Dropdown.Item id="transfer" textValue={t('transfer')}>
                  <Icon icon="solar:arrow-right-linear" width={16} />
                  <span>{t('transfer')}</span>
                </Dropdown.Item>
              )}
              {onShowHistory && (
                <Dropdown.Item id="history" textValue={t('history')}>
                  <Icon icon="solar:history-linear" width={16} />
                  <span>{t('history')}</span>
                </Dropdown.Item>
              )}
              {!isAwaitingDelivery && (
                <Dropdown.Item id="withdraw" variant="danger" textValue={t('withdraw')}>
                  <Icon icon="solar:arrow-up-linear" width={16} />
                  <span>{t('withdraw')}</span>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      }
    />
  );
};

export default BackpackItemCard;
