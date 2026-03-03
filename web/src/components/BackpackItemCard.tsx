'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Textarea,
} from '@heroui/react';
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
      return 'primary';
    case ItemRarity.RARE:
      return 'secondary';
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
      return 'primary';
    case 'admin':
      return 'secondary';
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
  onNoteChange?: (item: BackpackItem, note: string) => void;
}

const BackpackItemCard = ({
  item,
  onPutToAuction,
  onPutToLottery,
  onTransfer,
  onWithdraw,
  onNoteChange,
}: BackpackItemCardProps) => {
  const t = useTranslations('backpackItemCard');
  const [isEditingNote, setIsEditingNote] = React.useState(false);
  const [noteValue, setNoteValue] = React.useState(item.note ?? '');

  const handleSaveNote = () => {
    onNoteChange?.(item, noteValue);
    setIsEditingNote(false);
  };

  const handleCancelNote = () => {
    setNoteValue(item.note ?? '');
    setIsEditingNote(false);
  };

  return (
    <Card className="border border-divider shadow-none bg-content1 hover:border-default-400 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-default-100">
              <Icon icon={getCategoryIcon(item.category)} width={20} className="text-default-500" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-foreground">{item.name}</h4>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Chip size="sm" color={getRarityColor(item.rarity) as any} variant="flat">
                  {item.rarity.toUpperCase()}
                </Chip>
                <Chip size="sm" color={getAcquiredColor(item.acquiredFrom) as any} variant="dot">
                  {item.acquiredFrom.charAt(0).toUpperCase() + item.acquiredFrom.slice(1)}
                </Chip>
              </div>
            </div>
          </div>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button isIconOnly variant="light" size="sm" className="text-default-400">
                <Icon icon="solar:menu-dots-bold" width={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Item actions">
              <DropdownItem
                key="note"
                startContent={<Icon icon="solar:pen-2-linear" width={16} />}
                onPress={() => setIsEditingNote(true)}
              >
                {t('editNote')}
              </DropdownItem>
              <DropdownItem
                key="auction"
                startContent={<Icon icon="solar:hammer-linear" width={16} />}
                onPress={() => onPutToAuction?.(item)}
              >
                {t('putToAuction')}
              </DropdownItem>
              <DropdownItem
                key="lottery"
                startContent={<Icon icon="solar:ticket-linear" width={16} />}
                onPress={() => onPutToLottery?.(item)}
              >
                {t('putToLottery')}
              </DropdownItem>
              <DropdownItem
                key="transfer"
                startContent={<Icon icon="solar:arrow-right-linear" width={16} />}
                onPress={() => onTransfer?.(item)}
              >
                {t('transfer')}
              </DropdownItem>
              <DropdownItem
                key="withdraw"
                startContent={<Icon icon="solar:arrow-up-linear" width={16} />}
                className="text-danger"
                color="danger"
                onPress={() => onWithdraw?.(item)}
              >
                {t('withdraw')}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </CardHeader>

      <CardBody className="pt-0 flex flex-col gap-2">
        <p className="text-xs text-default-500 line-clamp-2">{item.description}</p>
        <p className="text-xs text-default-400">
          {t('acquired')} {new Date(item.acquiredAt).toLocaleDateString()}
        </p>

        {/* Note section */}
        <div className="border-t border-divider pt-2 mt-1">
          {isEditingNote ? (
            <div className="flex flex-col gap-2">
              <Textarea
                autoFocus
                size="sm"
                placeholder={t('addNote')}
                value={noteValue}
                onValueChange={setNoteValue}
                minRows={2}
                maxRows={4}
                classNames={{
                  input: 'text-xs',
                  inputWrapper: 'bg-content2 shadow-none border border-divider',
                }}
              />
              <div className="flex gap-1.5 justify-end">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleCancelNote}
                  className="h-6 text-xs px-2 min-w-0"
                >
                  {t('cancel')}
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleSaveNote}
                  className="h-6 text-xs px-2 min-w-0"
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              className="flex items-start gap-1.5 w-full text-left group"
              onClick={() => setIsEditingNote(true)}
            >
              <Icon
                icon="solar:pen-2-linear"
                width={12}
                className="text-default-300 group-hover:text-default-400 shrink-0 mt-0.5 transition-colors"
              />
              {noteValue ? (
                <p className="text-xs text-default-500 group-hover:text-default-600 transition-colors line-clamp-3">
                  {noteValue}
                </p>
              ) : (
                <p className="text-xs text-default-300 group-hover:text-default-400 italic transition-colors">
                  {t('addNote')}
                </p>
              )}
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default BackpackItemCard;
