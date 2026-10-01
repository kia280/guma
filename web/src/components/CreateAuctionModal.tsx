'use client';

import { Button, Label, ListBox, Modal, Select, Tabs, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { useGuildPermissions } from '@/lib/permissions';
import type { AuctionItem } from '@/types/auction';
import type { GuildBankItem } from '@/types/guild-bank';
import { ItemCategory, ItemRarity, type ItemSourceRef } from '@/types/item';
import { AuctionItemFields, AuctionPricingFields } from './AuctionFormFields';
import { BankItemPicker } from './BankItemPicker';
import { ItemThumbnail } from './ItemThumbnail';

export type AuctionDraftItem = {
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  source?: ItemSourceRef;
};

type ItemMode = 'manual' | 'bank';

const bankItemDraft = (item: GuildBankItem): AuctionDraftItem => ({
  name: item.name,
  description: item.description,
  category: item.category,
  rarity: item.rarity,
  source: { bankItemId: item.id },
});

type CreateAuctionModalProps = {
  state: UseOverlayStateReturn;
  item?: AuctionDraftItem | null;
  onCreated?: (auction: AuctionItem) => void;
};

const DURATIONS = [
  { hours: 6, key: '6hours' },
  { hours: 12, key: '12hours' },
  { hours: 24, key: '1day' },
  { hours: 48, key: '2days' },
  { hours: 72, key: '3days' },
  { hours: 168, key: '1week' },
] as const;

const EMPTY_ITEM: AuctionDraftItem = {
  name: '',
  description: '',
  category: ItemCategory.WEAPON,
  rarity: ItemRarity.COMMON,
};

export function CreateAuctionModal({ state, item, onCreated }: CreateAuctionModalProps) {
  const t = useTranslations('createAuctionModal');
  const notify = useToast();
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const [draft, setDraft] = React.useState<AuctionDraftItem>(EMPTY_ITEM);
  const [mode, setMode] = React.useState<ItemMode>('manual');
  const [bankItem, setBankItem] = React.useState<GuildBankItem | null>(null);
  const [startingBid, setStartingBid] = React.useState(100);
  const [minBidIncrement, setMinBidIncrement] = React.useState(10);
  const [duration, setDuration] = React.useState<number>(24);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const [resetFor, setResetFor] = React.useState<{ isOpen: boolean; item: CreateAuctionModalProps['item'] } | null>(null);
  if (resetFor === null || resetFor.isOpen !== state.isOpen || resetFor.item !== item) {
    setResetFor({ isOpen: state.isOpen, item });
    if (state.isOpen) {
      setDraft(item ?? EMPTY_ITEM);
      setMode('manual');
      setBankItem(null);
      setStartingBid(100);
      setMinBidIncrement(10);
      setDuration(24);
      setError('');
    }
  }

  const isFromBackpack = !!item;
  const canPickBankItem = !isFromBackpack && can('auctionBankItems');
  const isFromBank = canPickBankItem && mode === 'bank';
  const activeDraft = isFromBank ? (bankItem ? bankItemDraft(bankItem) : null) : draft;
  const canSubmit = !!activeDraft && activeDraft.name.trim() !== '' && startingBid > 0 && minBidIncrement > 0;

  const submit = async () => {
    if (!canSubmit || !activeDraft) return;
    setIsSubmitting(true);
    setError('');
    try {
      const auction = await apiClient.createAuction(guildId, {
        guildId,
        name: activeDraft.name.trim(),
        description: activeDraft.description.trim(),
        category: activeDraft.category,
        rarity: activeDraft.rarity,
        imageUrl: activeDraft.imageUrl,
        source: activeDraft.source,
        startingBid,
        minBidIncrement,
        duration,
      });
      onCreated?.(auction);
      notify.success(t('created'));
      state.close();
    } catch {
      setError(t('createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-col items-start gap-1">
              <Modal.Heading>{t('createNewAuction')}</Modal.Heading>
              <p className="type-caption text-hint">{t('subtitle')}</p>
            </Modal.Header>
            <Modal.Body>
              <form
                className="flex flex-col gap-4"
                onSubmit={event => {
                  event.preventDefault();
                  submit();
                }}
              >
                {canPickBankItem && (
                  <Tabs variant="secondary" selectedKey={mode} onSelectionChange={key => setMode(key as ItemMode)}>
                    <Tabs.ListContainer>
                      <Tabs.List aria-label={t('itemSource')}>
                        <Tabs.Tab id="manual">
                          {t('itemSourceManual')}
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="bank">
                          {t('itemSourceBank')}
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                )}
                {isFromBank && <BankItemPicker value={bankItem} onChange={setBankItem} />}
                {isFromBackpack || isFromBank ? (
                  activeDraft && (
                    <div className="flex items-center gap-3 rounded-xl border border-divider bg-surface-secondary p-3">
                      <ItemThumbnail category={activeDraft.category} rarity={activeDraft.rarity} imageUrl={activeDraft.imageUrl} />
                      <div className="min-w-0">
                        <p className="type-body font-medium text-foreground truncate">{activeDraft.name}</p>
                        <p className="type-caption text-hint">
                          {t(`rarities.${activeDraft.rarity}`)} · {t(activeDraft.source?.bankItemId ? 'sourceBankHint' : 'sourceBackpackHint')}
                        </p>
                      </div>
                    </div>
                  )
                ) : (
                  <AuctionItemFields values={draft} onChange={updates => setDraft(d => ({ ...d, ...updates }))} autoFocus />
                )}

                <AuctionPricingFields
                  values={{ startingBid, minBidIncrement }}
                  onChange={updates => {
                    if (updates.startingBid !== undefined) setStartingBid(updates.startingBid);
                    if (updates.minBidIncrement !== undefined) setMinBidIncrement(updates.minBidIncrement);
                  }}
                />

                <Select value={String(duration)} onChange={value => setDuration(Number(value))}>
                  <Label>{t('auctionDuration')}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {DURATIONS.map(option => (
                        <ListBox.Item key={option.hours} id={String(option.hours)} textValue={t(option.key)}>
                          {t(option.key)}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                {error && (
                  <p role="alert" className="type-caption text-danger">
                    {error}
                  </p>
                )}
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={state.close}>
                {t('cancel')}
              </Button>
              <Button isDisabled={!canSubmit} isPending={isSubmitting} onPress={submit}>
                <Icon icon="solar:sledgehammer-linear" width={16} />
                {t('createAuction')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
