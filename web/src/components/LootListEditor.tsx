'use client';

import { Button, Chip, Input, Label, NumberField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { getCategoryIcon, getRarityColor } from '@/components/ItemThumbnail';
import { GOLD_FORMAT_OPTIONS, GOLD_STEP, roundGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { LootEntry } from '@/types/checkin';

export const GOLD_LOOT_ICON = 'solar:wad-of-money-linear';

interface LootListEditorProps {
  items: LootEntry[];
  inputValue: string;
  onChange: (items: LootEntry[], inputValue: string) => void;
  label?: string;
  allowGold?: boolean;
  children?: React.ReactNode;
}

export function LootListEditor({ items, inputValue, onChange, label, allowGold = true, children }: LootListEditorProps) {
  const t = useTranslations('checkIn');
  const labels = useTranslations('createAuctionModal');
  const formatGold = useFormatGold();
  const labelId = React.useId();
  const [goldInput, setGoldInput] = React.useState<number>(Number.NaN);
  const hasGold = items.some(item => item.kind === 'gold');
  const goldAmount = Number.isFinite(goldInput) ? roundGold(goldInput) : 0;

  const handleAdd = () => {
    const name = inputValue.trim();
    if (!name) return;
    onChange([...items, { name }], '');
  };

  const handleAddGold = () => {
    if (goldAmount <= 0 || hasGold) return;
    onChange([...items, { kind: 'gold', name: '', amount: goldAmount }], inputValue);
    setGoldInput(Number.NaN);
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <p id={labelId} className="type-body font-medium text-foreground">{label ?? t('lootList')}</p>
      {children}
      <div className="flex gap-2">
        <Input
          aria-label={t('itemNamePlaceholder')}
          placeholder={t('itemNamePlaceholder')}
          value={inputValue}
          onChange={e => onChange(items, e.target.value)}
          variant="secondary"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          className="flex-1"
        />
        <Button
          size="sm"
          variant="secondary"
          isIconOnly
          aria-label={t('addLootItem')}
          onPress={handleAdd}
          isDisabled={!inputValue.trim()}
        >
          <Icon icon="solar:add-circle-linear" width={16} />
        </Button>
      </div>
      {allowGold && !hasGold && (
        <div className="flex items-end gap-2">
          <NumberField
            aria-label={t('goldLootAmount')}
            className="flex-1"
            formatOptions={GOLD_FORMAT_OPTIONS}
            minValue={0}
            step={GOLD_STEP}
            value={goldInput}
            onChange={value => setGoldInput(Number.isFinite(value) ? value : Number.NaN)}
          >
            <Label className="sr-only">{t('goldLootAmount')}</Label>
            <NumberField.Group>
              <NumberField.Input
                className="w-full min-w-0"
                placeholder={t('goldLootPlaceholder')}
                onKeyUp={e => {
                  if (e.key === 'Enter') handleAddGold();
                }}
              />
            </NumberField.Group>
          </NumberField>
          <Button
            size="sm"
            variant="secondary"
            isIconOnly
            aria-label={t('addGoldLoot')}
            onPress={handleAddGold}
          >
            <Icon icon={GOLD_LOOT_ICON} width={16} />
          </Button>
        </div>
      )}
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item, idx) => (
            <li
              key={`${idx}-${item.kind ?? 'item'}-${item.name}`}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-divider"
            >
              {item.kind === 'gold' ? (
                <div className="flex min-w-0 items-center gap-2 type-body">
                  <Icon icon={GOLD_LOOT_ICON} width={14} className="shrink-0 text-warning" />
                  <span className="text-foreground">{t('goldLoot')}</span>
                  <span className="font-medium tabular-nums text-foreground">{formatGold(item.amount ?? 0)}</span>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 type-body">
                  <Icon
                    icon={item.category ? getCategoryIcon(item.category) : 'solar:box-linear'}
                    width={14}
                    className="shrink-0 text-hint"
                  />
                  <span className="text-foreground truncate">{item.name}</span>
                  {item.rarity && (
                    <Chip size="sm" variant="secondary" color={getRarityColor(item.rarity)} className="shrink-0">
                      {labels(`rarities.${item.rarity}`)}
                    </Chip>
                  )}
                </div>
              )}
              <Button
                size="sm"
                isIconOnly
                variant="tertiary"
                aria-label={
                  item.kind === 'gold'
                    ? t('removeGoldLoot', { amount: formatGold(item.amount ?? 0) })
                    : t('removeLootItem', { name: item.name })
                }
                className="shrink-0 text-hint hover:text-danger"
                onPress={() => onChange(items.filter((_, i) => i !== idx), inputValue)}
              >
                <Icon icon="solar:close-circle-linear" width={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
