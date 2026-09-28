'use client';

import {
  Button,
  Chip,
  Description,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Select,
  Spinner,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import type { AttendanceMember, LootItem } from '@/types/checkin';
import type { GuildBankItem } from '@/types/guild-bank';
import { CreateAuctionModal, type AuctionDraftItem } from './CreateAuctionModal';
import { CreateLotteryModal, type LotteryPrizeItem } from './CreateLotteryModal';
import { ItemLockChip } from './ItemLockChip';
import { UserAvatar } from './UserAvatar';

type LoadStatus = 'loading' | 'ready' | 'error';

type CheckinLootDistributionProps = {
  checkinId: string;
  lootList: LootItem[];
  attendees: AttendanceMember[];
};

export function CheckinLootDistribution({ checkinId, lootList, attendees }: CheckinLootDistributionProps) {
  const t = useTranslations('checkinLoot');
  const labels = useTranslations('createAuctionModal');
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const { can } = useGuildPermissions();
  const assignModal = useOverlayState();
  const auctionModal = useOverlayState();
  const lotteryModal = useOverlayState();

  const [bankItems, setBankItems] = React.useState<GuildBankItem[]>([]);
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [assignTarget, setAssignTarget] = React.useState<GuildBankItem | null>(null);
  const [recipientId, setRecipientId] = React.useState<string | null>(null);
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [assignError, setAssignError] = React.useState<string | null>(null);
  const [auctionItem, setAuctionItem] = React.useState<AuctionDraftItem | null>(null);
  const [lotteryPrize, setLotteryPrize] = React.useState<LotteryPrizeItem | null>(null);

  const load = React.useCallback(() => {
    apiClient
      .listBankItems(guildId, { checkinId })
      .then(items => {
        setBankItems(items);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [guildId, checkinId]);

  React.useEffect(() => {
    load();
  }, [load]);

  useLiveResource(['bank'], load, { guildId });

  const canDistribute = can('distributeLoot');
  const canAuction = can('auctionBankItems');
  const canRaffle = can('createLottery');
  const eligibleAttendees = attendees.filter(member => member.userId);
  const inBank = new Map(bankItems.map(item => [item.id, item]));

  const openAssign = (item: GuildBankItem) => {
    setAssignTarget(item);
    setRecipientId(null);
    setAssignError(null);
    assignModal.open();
  };

  const submitAssign = async () => {
    if (!assignTarget || !recipientId) return;
    setIsAssigning(true);
    setAssignError(null);
    try {
      await apiClient.assignLoot(guildId, checkinId, assignTarget.id, recipientId);
      const recipient = eligibleAttendees.find(member => member.userId === recipientId);
      notify.success(t('assignSuccess', { item: assignTarget.name, name: recipient?.username ?? '' }));
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
    if (key === 'lottery') {
      setLotteryPrize({ name: item.name, source: { bankItemId: item.id } });
      lotteryModal.open();
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
              <div className="flex-1 min-w-0">
                <p className="type-body font-medium text-foreground truncate">{loot.name}</p>
                {loot.winner && <p className="type-caption text-hint">{t('wonBy', { name: loot.winner })}</p>}
              </div>
              {(loot.quantity ?? 0) > 1 && (
                <Chip size="sm" variant="secondary">
                  ×{loot.quantity}
                </Chip>
              )}
              {rowStatus(loot)}
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
                      disabledKeys={eligibleAttendees.length === 0 ? ['assign'] : []}
                      onAction={key => onAction(bankItem, key)}
                    >
                      <Dropdown.Item id="assign" textValue={t('assign')}>
                        <Icon icon="solar:user-hand-up-linear" width={16} />
                        <span>{t('assign')}</span>
                        {eligibleAttendees.length === 0 && (
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
                        <Dropdown.Item id="lottery" textValue={t('lottery')}>
                          <Icon icon="solar:ticket-linear" width={16} />
                          <span>{t('lottery')}</span>
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
                <Select
                  isRequired
                  placeholder={t('recipientPlaceholder')}
                  value={recipientId}
                  onChange={key => setRecipientId(key ? String(key) : null)}
                >
                  <Label>{t('recipient')}</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {eligibleAttendees.map(member => (
                        <ListBox.Item key={member.userId} id={member.userId} textValue={member.username}>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={member.username} src={member.avatar} className="size-6" />
                            <div className="flex flex-col">
                              <Label>{member.username}</Label>
                              {member.notes && <Description>{member.notes}</Description>}
                            </div>
                          </div>
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
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
                <Button variant="primary" isDisabled={!recipientId} isPending={isAssigning} onPress={submitAssign}>
                  {t('assignConfirm')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <CreateAuctionModal state={auctionModal} item={auctionItem} onCreated={load} />
      <CreateLotteryModal state={lotteryModal} prizeItem={lotteryPrize} onCreated={load} />
    </>
  );
}
