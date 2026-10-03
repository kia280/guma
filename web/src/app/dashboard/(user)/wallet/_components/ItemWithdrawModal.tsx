'use client';

import { Button, Modal, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { apiClient } from '@/lib/guma';
import type { BackpackItem } from '@/types/backpack';
import { useWalletAction } from '../_hooks/useWalletAction';
import { PendingLabel, WalletActionModal } from './WalletActionModal';
import { WarningNote } from './WarningNote';

type ItemWithdrawModalProps = {
  state: UseOverlayStateReturn;
  guildId: string;
  item: BackpackItem | null;
  onCompleted: () => void;
};

export function ItemWithdrawModal({ state, guildId, item, onCompleted }: ItemWithdrawModalProps) {
  const t = useTranslations('walletPage');
  const labels = useTranslations('createAuctionModal');
  const action = useWalletAction('withdrawItem', onCompleted);

  const [wasOpen, setWasOpen] = React.useState(state.isOpen);
  if (wasOpen !== state.isOpen) {
    setWasOpen(state.isOpen);
    if (state.isOpen) action.reset();
  }

  const handleWithdraw = () => {
    if (!item) return;
    const itemId = item.id;
    return action.run(
      () => apiClient.withdrawBackpackItem(guildId, itemId),
      t('withdrawItemSuccessDetail', { name: item.item.name }),
    );
  };

  return (
    <WalletActionModal state={state} action={action} successTitle={t('withdrawItemSuccess')}>
      <Modal.Header>
        <Modal.Heading>{t('withdrawItem')}</Modal.Heading>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-3">
        {item && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
              <div className="p-2 rounded-lg bg-default">
                <Icon icon="solar:backpack-linear" width={20} className="text-subtle" />
              </div>
              <div>
                <p className="type-body font-medium text-foreground">{item.item.name}</p>
                <p className="type-caption text-hint">
                  {labels(`rarities.${item.item.rarity}`)} · {labels(`categories.${item.item.category}`)}
                </p>
              </div>
            </div>
            <p className="type-body text-soft">
              {t.rich('withdrawItemConfirm', {
                name: item.item.name,
                strong: chunks => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </p>
            <WarningNote>{t('withdrawItemNote')}</WarningNote>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button slot="close" variant="secondary" isDisabled={action.isPending}>
          {t('cancel')}
        </Button>
        <Button variant="primary" onPress={handleWithdraw} isPending={action.isPending}>
          {({ isPending }) => <PendingLabel isPending={isPending}>{t('withdrawItem')}</PendingLabel>}
        </Button>
      </Modal.Footer>
    </WalletActionModal>
  );
}
