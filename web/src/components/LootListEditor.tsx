'use client';

import React from 'react';
import { Button, Chip, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { getCategoryIcon, getRarityColor } from '@/components/ItemThumbnail';
import type { LootEntry } from '@/types/checkin';

interface LootListEditorProps {
  items: LootEntry[];
  inputValue: string;
  onChange: (items: LootEntry[], inputValue: string) => void;
  children?: React.ReactNode;
}

export function LootListEditor({ items, inputValue, onChange, children }: LootListEditorProps) {
  const t = useTranslations('checkIn');
  const labels = useTranslations('createAuctionModal');
  const labelId = React.useId();

  const handleAdd = () => {
    const name = inputValue.trim();
    if (!name) return;
    onChange([...items, { name }], '');
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <p id={labelId} className="type-body font-medium text-foreground">{t('lootList')}</p>
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
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item, idx) => (
            <li
              key={`${idx}-${item.name}`}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-divider"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  icon={item.category ? getCategoryIcon(item.category) : 'solar:box-linear'}
                  width={14}
                  className="shrink-0 text-hint"
                />
                <span className="type-body text-foreground truncate">{item.name}</span>
                {item.rarity && (
                  <Chip size="sm" variant="secondary" color={getRarityColor(item.rarity)} className="shrink-0">
                    {labels(`rarities.${item.rarity}`)}
                  </Chip>
                )}
              </div>
              <Button
                size="sm"
                isIconOnly
                variant="tertiary"
                aria-label={t('removeLootItem', { name: item.name })}
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
