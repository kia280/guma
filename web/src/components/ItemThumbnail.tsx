import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { ItemCategory, ItemRarity } from '@/types/item';

export type RarityColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const CATEGORY_ICONS: Record<ItemCategory, string> = {
  [ItemCategory.WEAPON]: 'tabler:sword',
  [ItemCategory.ARMOR]: 'solar:shield-check-linear',
  [ItemCategory.SKILL_SCROLL]: 'solar:book-2-linear',
  [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
  [ItemCategory.ACCESSORY]: 'solar:stars-linear',
  [ItemCategory.MATERIAL]: 'solar:box-linear',
  [ItemCategory.MISC]: 'solar:box-linear',
};

const RARITY_COLORS: Record<ItemRarity, RarityColor> = {
  [ItemRarity.COMMON]: 'default',
  [ItemRarity.UNCOMMON]: 'success',
  [ItemRarity.RARE]: 'accent',
  [ItemRarity.EPIC]: 'warning',
  [ItemRarity.LEGENDARY]: 'danger',
  [ItemRarity.MYTHIC]: 'danger',
};

const TINT_BY_COLOR: Record<RarityColor, string> = {
  default: 'bg-default text-subtle',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export const getCategoryIcon = (category: ItemCategory) => CATEGORY_ICONS[category] ?? 'solar:box-linear';

export const getRarityColor = (rarity: ItemRarity): RarityColor => RARITY_COLORS[rarity] ?? 'default';

type ItemThumbnailProps = {
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  className?: string;
};

export function ItemThumbnail({ category, rarity, imageUrl, className }: ItemThumbnailProps) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg',
        TINT_BY_COLOR[getRarityColor(rarity)],
        className
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt="" className="size-full object-cover" />
      ) : (
        <Icon icon={getCategoryIcon(category)} width={20} />
      )}
    </div>
  );
}
