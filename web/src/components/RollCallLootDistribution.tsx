'use client';

import { Button, Chip, Dropdown, Modal, Spinner, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import type { GuildBankItem } from '@/types/guild-bank';
import type { Attendee, LootItem } from '@/types/roll-call';
import { CreateAuctionModal, type AuctionDraftItem } from './CreateAuctionModal';
import { CreateRaffleModal, type RafflePrizeItem } from './CreateRaffleModal';
import { ItemLockChip } from './ItemLockChip';
import { MemberComboBox, type MemberOption } from './MemberComboBox';

type LoadStatus = 'loading' | 'ready' | 'error';

type RollCallLootDistributionProps = {
  rollCallId: string;
  lootList: LootItem[];
  attendees: Attendee[];
  isCompleted?: boolean;
  onVaultCountChange?: (count: number) => void;
};

export function RollCallLootDistribution({
  rollCallId,
  lootList,
  attendees,
  isCompleted = false,
  onVaultCountChange,
}: RollCallLootDistributionProps) {
  const t = useTranslations('rollCallLoot');
  const labels = useTranslations('createAuctionModal');
  const userName = useUserName();
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const { can } = useGuildPermissions();
  const assignModal = useOverlayState();
  const auctionModal = useOverlayState();
  const raffleModal = useOverlayState();

  const [bankItems, setBankItems] = React.useState<GuildBankItem[]>([]);
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [assignTarget, setAssignTarget] = React.useState<GuildBankItem | null>(null);
  const [recipientId, setRecipientId] = React.useState('');
  const [showRecipientError, setShowRecipientError] = React.useState(false);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [auctionItem, setAuctionItem] = React.useState<AuctionDraftItem | null>(null);
  const [rafflePrize, setRafflePrize] = React.useState<RafflePrizeItem | null>(null);

  const load = React.useCallback(() => {
    apiClient
      .listBankItems(guildId, { rollCallId })
      .then(items => {
        setBankItems(items);
        setStatus('ready');
        onVaultCountChange?.(items.length);
      })
      .catch(() => setStatus('error'));
  }, [guildId, rollCallId, onVaultCountChange]);

  React.useEffect(() => {
    load();
  }, [load]);

  useLiveResource(['bank'], load, { guildId });

  const canDistribute = can('distributeLoot') && !isCompleted;
  const canAuction = can('auctionBankItems');
  const canRaffle = can('createRaffle');
  const recipientOptions = React.useMemo<MemberOption[]>(
    () =>
      attendees.flatMap(member =>
        member.userId
          ? [{ id: member.userId, name: userName(member.username), avatar: member.avatar, description: member.notes }]
          : [],
      ),
    [attendees, userName],
  );
  const inBank = new Map(bankItems.map(item => [item.id, item]));

  const openAssign = (item: GuildBankItem) => {
    setAssignTarget(item);
    setRecipientId('');
    setShowRecipientError(false);
    setAssignError(null);
    assignModal.open();
  };

  const submitAssign = async () => {
    if (!assignTarget) return;
    if (!recipientId) {
      setShowRecipientError(true);
      return;
    }
    setIsAssigning(true);
    setAssignError(null);
    try {
      await apiClient.assignLoot(guildId, rollCallId, assignTarget.id, recipientId);
      const recipient = recipientOptions.find(member => member.id === recipientId);
      notify.success(t('assignSuccess', { item: assignTarget.name, name: recipient?.name ?? '' }));
      assignModal.close();
      load();
    } catch (err) {
      setAssignError(apiErrorCode(err) === GrpcCode.FailedPrecondition ? t('assignConflict') : t('assignFailed'));
      load();
    } finally {
      setIsAssigning(false);
    }
  };

  const onAction = (item: GuildBankItem, key: React.Key) => {
    if (key === 'assign') openAssign(item);
    if (key === 'auction') {
      setAuctionItem({
        name: item.name,
        description: item.description,
        category: item.category,
        rarity: item.rarity,
        source: { bankItemId: item.id },
      });
      auctionModal.open();
    }
    if (key === 'raffle') {
      setRafflePrize({ name: item.name, source: { bankItemId: item.id } });
      raffleModal.open();
    }
  };

  const rowStatus = (loot: LootItem) => {
    if (status === 'loading') return <Spinner size="sm" aria-label={t('loading')} />;
    if (status === 'error') return null;
    const bankItem = inBank.get(loot.id);
    if (!bankItem) {
      return (
        <Chip size="sm" variant="secondary" color="success">
          {t('distributed')}
        </Chip>
      );
    }
    if (bankItem.lock) return <ItemLockChip lock={bankItem.lock} />;
    return (
      <Chip size="sm" variant="secondary" color={bankItem.pendingRequestCount > 0 ? 'warning' : 'default'}>
        {bankItem.pendingRequestCount > 0
          ? t('inBankWithRequests', { count: bankItem.pendingRequestCount })
          : isCompleted
            ? t('keptInBank')
            : t('inBank')}
      </Chip>
    );
  };

  return (
    <>
      {status === 'error' && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-divider p-3">
          <p className="type-caption text-danger">{t('loadFailed')}</p>
          <Button size="sm" variant="secondary" onPress={load}>
            {t('retry')}
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {lootList.map(loot => {
          const bankItem = inBank.get(loot.id);
          const showActions = canDistribute && !!bankItem && !bankItem.lock;
          return (
            <div
              key={loot.id}
              className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-divider bg-surface-secondary type-body"
            >
              <div className="p-1.5 rounded-lg bg-default shrink-0">
                <Icon icon="solar:box-linear" width={16} className="text-subtle" />
              </div>
              <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-3">
                <div className="min-w-0 sm:flex-1">
                  <p className="type-body font-medium text-foreground wrap-break-word">{loot.name}</p>
                  {loot.winner && <p className="type-caption text-hint">{t('wonBy', { name: loot.winner })}</p>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 empty:hidden sm:mt-0 sm:shrink-0">
                  {(loot.quantity ?? 0) > 1 && (
                    <Chip size="sm" variant="secondary">
                      ×{loot.quantity}
                    </Chip>
                  )}
                  {rowStatus(loot)}
                </div>
              </div>
              {showActions && (
                <Dropdown>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    className="text-hint shrink-0 max-sm:size-11"
                    aria-label={t('actionsFor', { item: loot.name })}
                  >
                    <Icon icon="solar:menu-dots-bold" width={16} />
                  </Button>
                  <Dropdown.Popover>
                    <Dropdown.Menu
                      aria-label={t('actionsFor', { item: loot.name })}
                      disabledKeys={recipientOptions.length === 0 ? ['assign'] : []}
                      onAction={key => onAction(bankItem, key)}
                    >
                      <Dropdown.Item id="assign" textValue={t('assign')}>
                        <Icon icon="solar:user-hand-up-linear" width={16} />
                        <span>{t('assign')}</span>
                        {recipientOptions.length === 0 && (
                          <span className="ml-auto type-caption text-hint">{t('noAttendees')}</span>
                        )}
                      </Dropdown.Item>
                      {canAuction && (
                        <Dropdown.Item id="auction" textValue={t('auction')}>
                          <Icon icon="solar:sledgehammer-linear" width={16} />
                          <span>{t('auction')}</span>
                        </Dropdown.Item>
                      )}
                      {canRaffle && (
                        <Dropdown.Item id="raffle" textValue={t('raffle')}>
                          <Icon icon="solar:ticket-linear" width={16} />
                          <span>{t('raffle')}</span>
                        </Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              )}
            </div>
          );
        })}
      </div>

      <Modal state={assignModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('assignTitle', { item: assignTarget?.name ?? '' })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {assignTarget && (
                  <p className="type-caption text-hint">
                    {labels(`rarities.${assignTarget.rarity}`)} · {labels(`categories.${assignTarget.category}`)}
                  </p>
                )}
                <p className="type-body text-soft">{t('assignDescription')}</p>
                {assignTarget && assignTarget.pendingRequestCount > 0 && (
                  <p className="type-caption text-warning">
                    {t('assignRejectsRequests', { count: assignTarget.pendingRequestCount })}
                  </p>
                )}
                <MemberComboBox
                  members={recipientOptions}
                  value={recipientId}
                  onChange={setRecipientId}
                  label={t('recipient')}
                  placeholder={t('recipientPlaceholder')}
                  emptyMessage={t('noAttendees')}
                  isInvalid={showRecipientError && !recipientId}
                  errorMessage={t('recipientRequired')}
                />
                {assignError && (
                  <p role="alert" className="type-caption text-danger">
                    {assignError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t('cancel')}
                </Button>
                <Button variant="primary" isPending={isAssigning} onPress={submitAssign}>
                  {t('assignConfirm')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <CreateAuctionModal state={auctionModal} item={auctionItem} onCreated={load} />
      <CreateRaffleModal state={raffleModal} prizeItem={rafflePrize} onCreated={load} />
    </>
  );
}
