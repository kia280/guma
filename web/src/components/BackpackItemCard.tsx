'use client';

import { useTranslations } from 'next-intl';
import { Card, Chip, Button, Dropdown } from '@heroui/react';
import { Icon } from '@iconify/react';
import { BackpackItem } from '@/types/backpack';
import { ItemThumbnail, getRarityColor } from './ItemThumbnail';

const getAcquiredColor = (acquiredFrom: BackpackItem['acquiredFrom']) => {
  switch (acquiredFrom) {
    case 'auction':
      return 'warning';
    case 'lottery':
      return 'success';
    case 'transfer':
      return 'accent';
    case 'admin':
      return 'default';
    default:
      return 'default';
  }
};

interface BackpackItemCardProps {
  item: BackpackItem;
  onPutToAuction?: (item: BackpackItem) => void;
  onPutToLottery?: (item: BackpackItem) => void;
  onWithdraw?: (item: BackpackItem) => void;
}

const BackpackItemCard = ({
  item,
  onPutToAuction,
  onPutToLottery,
  onWithdraw,
}: BackpackItemCardProps) => {
  const t = useTranslations('backpackItemCard');

  return (
    <Card className="border border-divider shadow-none bg-surface-secondary hover:border-foreground/20 transition-colors p-2.5 rounded-xl">
      <Card.Content className="flex flex-row items-center gap-3 p-0">
        <ItemThumbnail category={item.item.category} rarity={item.item.rarity} imageUrl={item.item.imageUrl} />
        <div className="flex-1 min-w-0">
          <p className="type-body font-medium text-foreground truncate">{item.item.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Chip size="sm" color={getRarityColor(item.item.rarity)} variant="secondary" className="capitalize">
              {item.item.rarity}
            </Chip>
            <Chip size="sm" color={getAcquiredColor(item.acquiredFrom)} variant="secondary" className="capitalize">
              {item.acquiredFrom}
            </Chip>
          </div>
        </div>
        <Dropdown>
          <Button isIconOnly variant="ghost" size="sm" className="text-hint shrink-0" aria-label={t('actions')}>
            <Icon icon="solar:menu-dots-bold" width={16} />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label={t('actions')}
              disabledKeys={['transfer']}
              onAction={key => {
                if (key === 'auction') onPutToAuction?.(item);
                if (key === 'lottery') onPutToLottery?.(item);
                if (key === 'withdraw') onWithdraw?.(item);
              }}
            >
              <Dropdown.Item id="auction" textValue={t('putToAuction')}>
                <Icon icon="solar:sledgehammer-linear" width={16} />
                <span>{t('putToAuction')}</span>
              </Dropdown.Item>
              <Dropdown.Item id="lottery" textValue={t('putToLottery')}>
                <Icon icon="solar:ticket-linear" width={16} />
                <span>{t('putToLottery')}</span>
              </Dropdown.Item>
              <Dropdown.Item id="transfer" textValue={t('transfer')}>
                <Icon icon="solar:arrow-right-linear" width={16} />
                <span>{t('transfer')}</span>
                <span className="ml-auto type-caption text-hint">{t('comingSoon')}</span>
              </Dropdown.Item>
              <Dropdown.Item id="withdraw" variant="danger" textValue={t('withdraw')}>
                <Icon icon="solar:arrow-up-linear" width={16} />
                <span>{t('withdraw')}</span>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Card.Content>
    </Card>
  );
};

export default BackpackItemCard;
