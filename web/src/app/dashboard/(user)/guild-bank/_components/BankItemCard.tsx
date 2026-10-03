'use client';

import { Chip, Dropdown, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemCard, ItemCardAction } from '@/components/ItemCard';
import { ItemLockChip } from '@/components/ItemLockChip';
import type { GuildBankItem } from '@/types/guild-bank';

type BankItemCardProps = {
  item: GuildBankItem;
  canDelete: boolean;
  onRequest: (item: GuildBankItem) => void;
  onDelete: (item: GuildBankItem) => void;
  onShowHistory: (item: GuildBankItem) => void;
};

export function BankItemCard({ item, canDelete, onRequest, onDelete, onShowHistory }: BankItemCardProps) {
  const t = useTranslations('guildBankPage');
  return (
    <ItemCard
      name={item.name}
      quantity={item.quantity}
      category={item.category}
      rarity={item.rarity}
      source={
        item.rollCallId
          ? {
              icon: 'solar:clipboard-check-linear',
              text: t('fromRollCall', { title: item.rollCallTitle || t('untitledRollCall') }),
              href: `/dashboard/roll-calls/${item.rollCallId}`,
            }
          : undefined
      }
      chips={
        (item.lock || item.requestedByMe || item.pendingRequestCount > 0) && (
          <>
            {item.lock && <ItemLockChip lock={item.lock} />}
            {item.requestedByMe ? (
              <Chip size="sm" color="accent" variant="secondary">
                {t('requestedByMe')}
              </Chip>
            ) : item.pendingRequestCount > 0 && (
              <Chip size="sm" color="warning" variant="secondary">
                {t('pendingRequestCount', { count: item.pendingRequestCount })}
              </Chip>
            )}
          </>
        )
      }
      actions={
        <Dropdown>
          <ItemCardAction aria-label={t('itemActions')}>
            <Icon icon="solar:menu-dots-bold" width={16} />
          </ItemCardAction>
          <Dropdown.Popover>
            <Dropdown.Menu
              aria-label={t('itemActions')}
              disabledKeys={[
                ...(item.requestedByMe || item.lock ? ['request'] : []),
                ...(item.lock ? ['delete'] : []),
              ]}
              onAction={key => {
                if (key === 'request') onRequest(item);
                if (key === 'delete') onDelete(item);
                if (key === 'history') onShowHistory(item);
              }}
            >
              <Dropdown.Item id="request" textValue={item.requestedByMe ? t('alreadyRequested') : t('requestItem')}>
                <Icon icon={item.requestedByMe ? 'solar:check-circle-linear' : 'solar:hand-shake-linear'} width={16} />
                <span>{item.requestedByMe ? t('alreadyRequested') : t('requestItem')}</span>
              </Dropdown.Item>
              <Dropdown.Item id="history" textValue={t('history')}>
                <Icon icon="solar:history-linear" width={16} />
                <span>{t('history')}</span>
              </Dropdown.Item>
              {canDelete && (
                <Dropdown.Item id="delete" variant="danger" textValue={t('deleteItem')}>
                  <Icon icon="solar:trash-bin-trash-linear" width={16} className="text-danger" />
                  <Label>{t('deleteItem')}</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      }
    >
      {item.requestedByMe && item.pendingRequestCount > 1 && (
        <p className="mt-0.5 type-caption text-hint">
          {t('otherPendingRequests', { count: item.pendingRequestCount - 1 })}
        </p>
      )}
    </ItemCard>
  );
}
