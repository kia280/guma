'use client';

import { Description, Label, ListBox, Select, type Key } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { getCategoryIcon } from '@/components/ItemThumbnail';
import type { ItemTemplate } from '@/types/roll-call';

interface ItemTemplatePickerProps {
  templates: ItemTemplate[];
  onPick: (template: ItemTemplate) => void;
  placeholder: string;
  isDisabled?: boolean;
  description?: React.ReactNode;
}

export function ItemTemplatePicker({ templates, onPick, placeholder, isDisabled, description }: ItemTemplatePickerProps) {
  const t = useTranslations('itemTemplates');
  const labels = useTranslations('createAuctionModal');

  const handleChange = (key: Key | null) => {
    const template = templates.find(item => item.id === key);
    if (template) onPick(template);
  };

  return (
    <Select
      placeholder={placeholder}
      value={null}
      onChange={handleChange}
      isDisabled={isDisabled || templates.length === 0}
    >
      <Label>{t('addFromLibrary')}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {templates.map(template => (
            <ListBox.Item key={template.id} id={template.id} textValue={template.name}>
              <div className="flex min-w-0 items-center gap-2">
                <Icon icon={getCategoryIcon(template.category)} width={16} className="shrink-0 text-subtle" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate">{template.name}</span>
                  <span className="type-caption text-hint truncate">
                    {labels(`categories.${template.category}`)} · {labels(`rarities.${template.rarity}`)}
                  </span>
                </div>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {description && <Description>{description}</Description>}
    </Select>
  );
}
