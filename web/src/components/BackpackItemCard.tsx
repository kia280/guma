'use client';

import { useTranslations } from 'next-intl';
import { Card, Chip, Button, Dropdown } from '@heroui/react';
import { Icon } from '@iconify/react';
import { BackpackItem } from '@/types/backpack';
import { ItemCategory, ItemRarity } from '@/types/item';

const getCategoryIcon = (category: ItemCategory) => {
  const icons: Record<ItemCategory, string> = {
    [ItemCategory.WEAPON]: 'tabler:sword',
    [ItemCategory.ARMOR]: 'solar:shield-check-linear',
    [ItemCategory.SKILL_SCROLL]: 'solar:book-2-linear',
    [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
    [ItemCategory.ACCESSORY]: 'solar:stars-linear',
    [ItemCategory.MATERIAL]: 'solar:box-linear',
    [ItemCategory.MISC]: 'solar:box-linear',
  };
  return icons[category] ?? 'solar:box-linear';
};

const getRarityColor = (rarity: ItemRarity) => {
  switch (rarity) {
    case ItemRarity.COMMON:
      return 'default';
    case ItemRarity.UNCOMMON:
      return 'accent';
    case ItemRarity.RARE:
      return 'default';
    case ItemRarity.EPIC:
      return 'warning';
    case ItemRarity.LEGENDARY:
      return 'danger';
    case ItemRarity.MYTHIC:
      return 'success';
    default:
      return 'default';
  }
};

const TINT_BY_COLOR: Record<ReturnType<typeof getRarityColor>, string> = {
  default: 'bg-default text-subtle',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

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
  onTransfer?: (item: BackpackItem) => void;
  onWithdraw?: (item: BackpackItem) => void;
}

const BackpackItemCard = ({
  item,
  onPutToAuction,
  onPutToLottery,
  onTransfer,
  onWithdraw,
}: BackpackItemCardProps) => {
  const t = useTranslations('backpackItemCard');

  return (
    <Card className="border border-divider shadow-none bg-surface-secondary hover:border-foreground/20 transition-colors p-2.5 rounded-xl">
      <Card.Content className="flex flex-row items-center gap-3 p-0">
        <div
          className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${TINT_BY_COLOR[getRarityColor(item.item.rarity)]}`}
        >
          {item.item.imageUrl ? (
            <img src={item.item.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <Icon icon={getCategoryIcon(item.item.category)} width={20} />
          )}
        </div>
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
              onAction={key => {
                if (key === 'auction') onPutToAuction?.(item);
                if (key === 'lottery') onPutToLottery?.(item);
                if (key === 'transfer') onTransfer?.(item);
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
