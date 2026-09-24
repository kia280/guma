'use client';

import React from 'react';
import { Button, Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

interface LootListEditorProps {
  items: string[];
  inputValue: string;
  onChange: (items: string[], inputValue: string) => void;
}

export function LootListEditor({ items, inputValue, onChange }: LootListEditorProps) {
  const t = useTranslations('checkIn');
  const labelId = React.useId();

  const handleAdd = () => {
    const name = inputValue.trim();
    if (!name) return;
    onChange([...items, name], '');
  };

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <p id={labelId} className="type-body font-medium text-foreground">{t('lootList')}</p>
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
          {items.map((name, idx) => (
            <li
              key={`${idx}-${name}`}
              className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-secondary border border-divider"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Icon icon="solar:box-linear" width={14} className="shrink-0 text-hint" />
                <span className="type-body text-foreground truncate">{name}</span>
              </div>
              <Button
                size="sm"
                isIconOnly
                variant="tertiary"
                aria-label={t('removeLootItem', { name })}
                className="text-hint hover:text-danger"
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
