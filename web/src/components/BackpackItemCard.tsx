'use client';

import { useTranslations } from 'next-intl';
import { Card, Chip, Button, Dropdown } from '@heroui/react';
import { Icon } from '@iconify/react';
import { BackpackItem } from '@/types/backpack';
import { ItemCategory, ItemRarity } from '@/types/auction';

const getCategoryIcon = (category: ItemCategory) => {
  const icons: Record<ItemCategory, string> = {
    [ItemCategory.WEAPON]: 'solar:wrench-linear',
    [ItemCategory.ARMOR]: 'solar:shield-check-linear',
    [ItemCategory.SKILL_SCROLL]: 'solar:book-open-linear',
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
    <Card className="border border-divider shadow-none bg-surface-secondary hover:border-default-400 transition-colors">
      <Card.Header className="pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-default-100">
              <Icon icon={getCategoryIcon(item.category)} width={20} className="text-foreground/50" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">{item.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Chip size="sm" color={getRarityColor(item.rarity)} variant="secondary">
                  {item.rarity.toUpperCase()}
                </Chip>
                <Chip size="sm" color={getAcquiredColor(item.acquiredFrom)} variant="secondary">
                  {item.acquiredFrom.charAt(0).toUpperCase() + item.acquiredFrom.slice(1)}
                </Chip>
              </div>
            </div>
          </div>

          <Dropdown>
            <Button isIconOnly variant="ghost" size="sm" className="text-foreground/40">
              <Icon icon="solar:menu-dots-bold" width={16} />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                aria-label="Item actions"
                onAction={key => {
                  if (key === 'auction') onPutToAuction?.(item);
                  if (key === 'lottery') onPutToLottery?.(item);
                  if (key === 'transfer') onTransfer?.(item);
                  if (key === 'withdraw') onWithdraw?.(item);
                }}
              >
                <Dropdown.Item id="auction" textValue={t('putToAuction')}>
                  <Icon icon="solar:hammer-linear" width={16} />
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
        </div>
      </Card.Header>

      <Card.Content className="pt-0 flex flex-col gap-2">
        <p className="text-xs text-foreground/50 line-clamp-2">{item.description}</p>
        <p className="text-xs text-foreground/40">
          {t('acquired')} {new Date(item.acquiredAt).toLocaleDateString()}
        </p>
      </Card.Content>
    </Card>
  );
};

export default BackpackItemCard;
