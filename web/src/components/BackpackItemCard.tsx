'use client';

import { Card, Chip, Button, Dropdown, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { BackpackItem } from '@/types/backpack';
import { ItemLockChip } from './ItemLockChip';
import { ItemThumbnail, getRarityColor } from './ItemThumbnail';

const SOURCE_ICONS: Record<BackpackItem['acquiredFrom'], string> = {
  auction: 'solar:sledgehammer-linear',
  lottery: 'solar:ticket-linear',
  transfer: 'solar:users-group-rounded-linear',
  bank: 'solar:safe-2-linear',
  checkin: 'solar:clipboard-check-linear',
  admin: 'solar:shield-user-linear',
};

const sourceHref = (item: BackpackItem): string | undefined => {
  if (!item.sourceId) return undefined;
  switch (item.acquiredFrom) {
    case 'auction':
      return `/dashboard/auction/${item.sourceId}`;
    case 'lottery':
      return `/dashboard/lottery/${item.sourceId}`;
    case 'checkin':
      return `/dashboard/attendance/${item.sourceId}`;
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
  const labels = useTranslations('createAuctionModal');
  const cardRef = React.useRef<HTMLDivElement>(null);
  const href = sourceHref(item);
  const isAwaitingDelivery = Boolean(item.deliveryRequestedAt);
  const sourceText = item.sourceLabel
    ? t(`sourceWithLabel.${item.acquiredFrom}`, { label: item.sourceLabel })
    : t(`acquiredFrom.${item.acquiredFrom}`);

  React.useEffect(() => {
    if (isHighlighted) cardRef.current?.scrollIntoView({ block: 'center' });
  }, [isHighlighted]);

  return (
    <Card
      ref={cardRef}
      className={cn(
        'border shadow-none bg-surface-secondary hover:border-foreground/20 transition-colors p-2.5 rounded-xl',
        isHighlighted ? 'border-accent ring-2 ring-accent/30' : 'border-divider',
      )}
    >
      <Card.Content className="flex flex-row items-center gap-3 p-0">
        <ItemThumbnail category={item.item.category} rarity={item.item.rarity} imageUrl={item.item.imageUrl} />
        <div className="flex-1 min-w-0">
          <p className="type-body font-medium text-foreground truncate">{item.item.name}</p>
          <div className="flex flex-wrap items-center gap-1 mt-0.5 type-caption">
            <Chip size="sm" color={getRarityColor(item.item.rarity)} variant="secondary">
              {labels(`rarities.${item.item.rarity}`)}
            </Chip>
            {item.lock && <ItemLockChip lock={item.lock} />}
            {isAwaitingDelivery && (
              <Chip size="sm" color="warning" variant="secondary">
                {t('awaitingDelivery')}
              </Chip>
            )}
          </div>
          {href ? (
            <Link
              href={href}
              className="mt-1 flex min-w-0 items-center gap-1 rounded type-caption text-hint hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Icon icon={SOURCE_ICONS[item.acquiredFrom]} width={14} className="shrink-0" aria-hidden />
              <span className="truncate">{sourceText}</span>
            </Link>
          ) : (
            <p className="mt-1 flex min-w-0 items-center gap-1 type-caption text-hint">
              <Icon icon={SOURCE_ICONS[item.acquiredFrom]} width={14} className="shrink-0" aria-hidden />
              <span className="truncate">{sourceText}</span>
            </p>
          )}
        </div>
        <Dropdown>
          <Button isIconOnly variant="ghost" size="sm" className="text-hint shrink-0 max-sm:size-11" aria-label={t('actions')}>
            <Icon icon="solar:menu-dots-bold" width={16} />
          </Button>
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
      </Card.Content>
    </Card>
  );
};

export default BackpackItemCard;
