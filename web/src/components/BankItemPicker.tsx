'use client';

import { Button, Description, Label, ListBox, Select } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import type { GuildBankItem } from '@/types/guild-bank';

type BankItemPickerProps = {
  value: GuildBankItem | null;
  onChange: (item: GuildBankItem | null) => void;
};

type LoadStatus = 'loading' | 'ready' | 'error';

export function BankItemPicker({ value, onChange }: BankItemPickerProps) {
  const t = useTranslations('bankItemPicker');
  const labels = useTranslations('createAuctionModal');
  const guildId = useCurrentGuildId();
  const [items, setItems] = React.useState<GuildBankItem[]>([]);
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .listBankItems(guildId)
      .then(data => {
        if (cancelled) return;
        setItems(data.filter(item => !item.lock));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [guildId, reloadKey]);

  const retry = () => {
    setStatus('loading');
    setReloadKey(key => key + 1);
  };

  if (status === 'error') {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-divider p-3">
        <p className="type-caption text-danger">{t('loadFailed')}</p>
        <Button size="sm" variant="secondary" onPress={retry}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <Select
      isDisabled={status === 'loading' || items.length === 0}
      placeholder={status === 'loading' ? t('loading') : t('placeholder')}
      value={value?.id ?? null}
      onChange={key => onChange(items.find(item => item.id === key) ?? null)}
    >
      <Label>{t('label')}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      {status === 'ready' && items.length === 0 && <Description>{t('empty')}</Description>}
      <Select.Popover>
        <ListBox>
          {items.map(item => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.name}>
              <div className="flex flex-col">
                <Label>{item.name}</Label>
                <Description>
                  {labels(`rarities.${item.rarity}`)} · {labels(`categories.${item.category}`)}
                </Description>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
