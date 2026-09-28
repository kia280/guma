'use client';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  Modal,
  Spinner,
  TextArea,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { adminTabHref } from '@/lib/dashboard-nav';
import { apiClient } from '@/lib/guma';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { AuctionStatus, type AuctionItem } from '@/types/auction';
import type { BackpackItem } from '@/types/backpack';
import type { FundRequest, GuildBankItem, ItemRequest, ReviewDecision } from '@/types/guild-bank';

type LoadStatus = 'loading' | 'ready' | 'error';

type PendingRequest =
  | { kind: 'fund'; request: FundRequest }
  | { kind: 'item'; request: ItemRequest };

type AuctionAttention = 'overdue' | 'notStarted' | 'endingWithoutBids';

type AttentionAuction = { auction: AuctionItem; reason: AuctionAttention };

type LootGroup = { checkinId: string; title: string; items: GuildBankItem[]; oldest: string };

const HOUR_MS = 60 * 60 * 1000;
const ENDING_SOON_MS = 24 * HOUR_MS;
const START_GRACE_MS = 5 * 60 * 1000;
const INBOX_PAGE_SIZE = 100;

const requestKey = (entry: PendingRequest) => `${entry.kind}:${entry.request.id}`;

const auctionAttention = (auction: AuctionItem, now: number): AuctionAttention | null => {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (auction.status === AuctionStatus.ACTIVE && end <= now) return 'overdue';
  if (auction.status === AuctionStatus.UPCOMING && start + START_GRACE_MS <= now) return 'notStarted';
  if (auction.status === AuctionStatus.ACTIVE && !auction.currentBidder && end - now <= ENDING_SOON_MS) {
    return 'endingWithoutBids';
  }
  return null;
};

const groupLoot = (items: GuildBankItem[]): LootGroup[] => {
  const groups = new Map<string, LootGroup>();
  items.forEach(item => {
    if (!item.checkinId) return;
    const group = groups.get(item.checkinId) ?? {
      checkinId: item.checkinId,
      title: item.checkinTitle ?? '',
      items: [],
      oldest: item.donatedAt,
    };
    group.items.push(item);
    if (item.donatedAt < group.oldest) group.oldest = item.donatedAt;
    groups.set(item.checkinId, group);
  });
  return [...groups.values()].sort((a, b) => a.oldest.localeCompare(b.oldest));
};

function InboxSection({
  title,
  icon,
  count,
  status,
  emptyText,
  onRetry,
  actions,
  children,
}: {
  title: string;
  icon: string;
  count: number;
  status: LoadStatus;
  emptyText: string;
  onRetry: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations('adminInbox');
  return (
    <Card className="border border-divider shadow-none bg-surface">
      <Card.Header className="flex flex-row flex-wrap items-center gap-3 pb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default">
          <Icon className="text-subtle" icon={icon} width={20} />
        </div>
        <p className="type-subheading text-foreground">{title}</p>
        {status === 'ready' && (
          <Chip size="sm" variant="secondary">
            {count}
          </Chip>
        )}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </Card.Header>
      <Card.Content className="pt-0">
        {status === 'loading' ? (
          <div className="flex justify-center py-8">
            <Spinner aria-label={t('loading')} />
          </div>
        ) : status === 'error' ? (
          <Alert status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t('loadFailed')}</Alert.Title>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={onRetry}>
              {t('retry')}
            </Button>
          </Alert>
        ) : count === 0 ? (
          <p className="type-body text-disabled py-6 text-center">{emptyText}</p>
        ) : (
          children
        )}
      </Card.Content>
    </Card>
  );
}

export function AdminInbox({ guildId }: { guildId: string }) {
  const t = useTranslations('adminInbox');
  const userName = useUserName();
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const notify = useToast();
  const now = useNow(60 * 1000);
  const batchModal = useOverlayState();

  const [requests, setRequests] = React.useState<PendingRequest[]>([]);
  const [requestStatus, setRequestStatus] = React.useState<LoadStatus>('loading');
  const [auctions, setAuctions] = React.useState<AuctionItem[]>([]);
  const [auctionStatus, setAuctionStatus] = React.useState<LoadStatus>('loading');
  const [deliveries, setDeliveries] = React.useState<BackpackItem[]>([]);
  const [deliveryStatus, setDeliveryStatus] = React.useState<LoadStatus>('loading');
  const [deliveryTarget, setDeliveryTarget] = React.useState<BackpackItem | null>(null);
  const [loot, setLoot] = React.useState<GuildBankItem[]>([]);
  const [lootStatus, setLootStatus] = React.useState<LoadStatus>('loading');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [decision, setDecision] = React.useState<ReviewDecision>('approved');
  const [note, setNote] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);

  const loadRequests = React.useCallback(() => {
    Promise.all([apiClient.listFundRequests(guildId, 'pending'), apiClient.listItemRequests(guildId, 'pending')])
      .then(([funds, items]) => {
        const merged: PendingRequest[] = [
          ...funds.map(request => ({ kind: 'fund' as const, request })),
          ...items.map(request => ({ kind: 'item' as const, request })),
        ].sort((a, b) => a.request.createdAt.localeCompare(b.request.createdAt));
        setRequests(merged);
        setSelected(current => new Set([...current].filter(key => merged.some(entry => requestKey(entry) === key))));
        setRequestStatus('ready');
      })
      .catch(() => setRequestStatus('error'));
  }, [guildId]);

  const loadAuctions = React.useCallback(() => {
    Promise.all([
      apiClient.listAuctions(guildId, { status: 'ACTIVE', pageSize: INBOX_PAGE_SIZE }),
      apiClient.listAuctions(guildId, { status: 'UPCOMING', pageSize: INBOX_PAGE_SIZE }),
    ])
      .then(([active, upcoming]) => {
        setAuctions([...active, ...upcoming]);
        setAuctionStatus('ready');
      })
      .catch(() => setAuctionStatus('error'));
  }, [guildId]);

  const loadDeliveries = React.useCallback(() => {
    apiClient
      .listPendingDeliveries(guildId)
      .then(items => {
        setDeliveries(items);
        setDeliveryStatus('ready');
      })
      .catch(() => setDeliveryStatus('error'));
  }, [guildId]);

  const loadLoot = React.useCallback(() => {
    apiClient
      .listBankItems(guildId)
      .then(items => {
        setLoot(items.filter(item => item.checkinId && !item.lock));
        setLootStatus('ready');
      })
      .catch(() => setLootStatus('error'));
  }, [guildId]);

  React.useEffect(() => {
    loadRequests();
    loadAuctions();
    loadDeliveries();
    loadLoot();
  }, [loadRequests, loadAuctions, loadDeliveries, loadLoot]);

  useLiveResource(['bank'], () => {
    loadRequests();
    loadLoot();
  }, { guildId });
  useLiveResource(['auction'], loadAuctions, { guildId });
  useLiveResource(['delivery'], loadDeliveries, { guildId });

  const confirmDelivery = async () => {
    if (!deliveryTarget) return;
    try {
      await apiClient.confirmBackpackDelivery(guildId, deliveryTarget.id);
    } finally {
      loadDeliveries();
    }
    notify.success(t('deliveryConfirmed', { item: deliveryTarget.item.name, name: userName(deliveryTarget.ownerName) }));
  };

    const attention: AttentionAuction[] = auctions
    .map(auction => ({ auction, reason: auctionAttention(auction, now) }))
    .filter((entry): entry is AttentionAuction => entry.reason !== null)
    .sort((a, b) => a.auction.endTime.localeCompare(b.auction.endTime));
  const lootGroups = groupLoot(loot);

  const allSelected = requests.length > 0 && selected.size === requests.length;
  const toggleAll = (isSelected: boolean) =>
    setSelected(isSelected ? new Set(requests.map(requestKey)) : new Set());
  const toggleOne = (key: string, isSelected: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      if (isSelected) next.add(key);
      else next.delete(key);
      return next;
    });

  const openBatch = (next: ReviewDecision) => {
    setDecision(next);
    setNote('');
    batchModal.open();
  };

  const runBatch = async () => {
    const targets = requests.filter(entry => selected.has(requestKey(entry)));
    setIsProcessing(true);
    let succeeded = 0;
    const trimmed = note.trim() || undefined;
    for (const entry of targets) {
      try {
        if (entry.kind === 'fund') {
          await apiClient.reviewFundRequest(guildId, entry.request.id, decision, trimmed);
        } else {
          await apiClient.reviewItemRequest(guildId, entry.request.id, decision, trimmed);
        }
        succeeded += 1;
      } catch {
        continue;
      }
    }
    setIsProcessing(false);
    batchModal.close();
    setSelected(new Set());
    loadRequests();
    const failed = targets.length - succeeded;
    if (failed === 0) notify.success(t('batchSuccess', { count: succeeded, decision }));
    else notify.error(t('batchPartial', { succeeded, failed, decision }));
  };

  const formatAge = (value: string) => format.relativeTime(new Date(value), now);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-live="polite">
        <Chip variant="secondary" color={requests.length > 0 ? 'warning' : 'default'}>
          {t('summaryRequests', { count: requests.length })}
        </Chip>
        <Chip variant="secondary" color={attention.length > 0 ? 'warning' : 'default'}>
          {t('summaryAuctions', { count: attention.length })}
        </Chip>
        <Chip variant="secondary" color={deliveries.length > 0 ? 'warning' : 'default'}>
          {t('summaryDeliveries', { count: deliveries.length })}
        </Chip>
        <Chip variant="secondary" color={loot.length > 0 ? 'warning' : 'default'}>
          {t('summaryLoot', { count: loot.length })}
        </Chip>
      </div>

      <InboxSection
        title={t('pendingRequests')}
        icon="solar:inbox-in-linear"
        count={requests.length}
        status={requestStatus}
        emptyText={t('noPendingRequests')}
        onRetry={loadRequests}
        actions={
          requests.length > 0 && (
            <>
              <Button size="sm" variant="secondary" isDisabled={selected.size === 0} onPress={() => openBatch('rejected')}>
                {t('rejectSelected', { count: selected.size })}
              </Button>
              <Button size="sm" variant="primary" isDisabled={selected.size === 0} onPress={() => openBatch('approved')}>
                {t('approveSelected', { count: selected.size })}
              </Button>
            </>
          )
        }
      >
        <div className="flex flex-col gap-2">
          <Checkbox isSelected={allSelected} isIndeterminate={selected.size > 0 && !allSelected} onChange={toggleAll}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Label className="type-caption text-subtle">{t('selectAll')}</Label>
            </Checkbox.Content>
          </Checkbox>
          <ul className="flex flex-col gap-2">
            {requests.map(entry => {
              const key = requestKey(entry);
              const label =
                entry.kind === 'fund'
                  ? t('fundRequestLabel', { name: userName(entry.request.requesterName), amount: formatGold(entry.request.amount) })
                  : t('itemRequestLabel', { name: userName(entry.request.requesterName), item: entry.request.itemName || t('unknownItem') });
              return (
                <li key={key} className="flex items-start gap-3 rounded-lg bg-surface-secondary px-3 py-3">
                  <Checkbox aria-label={label} isSelected={selected.has(key)} onChange={value => toggleOne(key, value)} className="mt-0.5">
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                  <Icon
                    icon={entry.kind === 'fund' ? 'solar:dollar-minimalistic-linear' : 'solar:box-linear'}
                    width={18}
                    className="mt-0.5 shrink-0 text-subtle"
                    aria-hidden
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="type-body font-medium text-foreground break-words">{label}</p>
                    {entry.request.reason && <p className="type-caption text-subtle break-words">{entry.request.reason}</p>}
                    <p className="type-caption text-hint">{formatAge(entry.request.createdAt)}</p>
                  </div>
                  <Link
                    href={`${adminTabHref('bankRequests')}&request=${entry.request.id}`}
                    className="shrink-0 rounded type-caption text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {t('review')}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </InboxSection>

      <InboxSection
        title={t('auctionsNeedingAttention')}
        icon="solar:sledgehammer-linear"
        count={attention.length}
        status={auctionStatus}
        emptyText={t('noAuctionAttention')}
        onRetry={loadAuctions}
      >
        <ul className="flex flex-col gap-2">
          {attention.map(({ auction, reason }) => (
            <li key={auction.id}>
              <Link
                href={`/dashboard/auction/${auction.id}`}
                className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-3 hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="type-body font-medium text-foreground truncate">{auction.name}</p>
                  <p className="type-caption text-hint">
                    {t(`auctionReasonDetail.${reason}`, {
                      time: formatAge(reason === 'notStarted' ? auction.startTime : auction.endTime),
                    })}
                  </p>
                </div>
                <Chip size="sm" variant="secondary" color={reason === 'endingWithoutBids' ? 'warning' : 'danger'}>
                  {t(`auctionReason.${reason}`)}
                </Chip>
              </Link>
            </li>
          ))}
        </ul>
      </InboxSection>

      <InboxSection
        title={t('pendingDeliveries')}
        icon="solar:box-minimalistic-linear"
        count={deliveries.length}
        status={deliveryStatus}
        emptyText={t('noPendingDeliveries')}
        onRetry={loadDeliveries}
      >
        <ul className="flex flex-col gap-2">
          {deliveries.map(item => (
            <li key={item.id} className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="type-body font-medium text-foreground truncate">{item.item.name}</p>
                <p className="type-caption text-hint truncate">
                  {t('deliveryRequested', {
                    name: userName(item.ownerName),
                    time: formatAge(item.deliveryRequestedAt ?? item.acquiredAt),
                  })}
                </p>
              </div>
              <Button size="sm" variant="secondary" onPress={() => setDeliveryTarget(item)}>
                {t('confirmDelivery')}
              </Button>
            </li>
          ))}
        </ul>
      </InboxSection>

      <InboxSection
        title={t('undistributedLoot')}
        icon="solar:clipboard-check-linear"
        count={lootGroups.length}
        status={lootStatus}
        emptyText={t('noUndistributedLoot')}
        onRetry={loadLoot}
      >
        <ul className="flex flex-col gap-2">
          {lootGroups.map(group => (
            <li key={group.checkinId}>
              <Link
                href={`/dashboard/attendance/${group.checkinId}`}
                className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-3 hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="type-body font-medium text-foreground truncate">{group.title || t('untitledCheckin')}</p>
                  <p className="type-caption text-hint truncate">{group.items.map(item => item.name).join(', ')}</p>
                  <p className="type-caption text-hint">{t('lootWaiting', { time: formatAge(group.oldest) })}</p>
                </div>
                <Chip size="sm" variant="secondary">
                  {t('lootCount', { count: group.items.length })}
                </Chip>
              </Link>
            </li>
          ))}
        </ul>
      </InboxSection>

      <ConfirmDialog
        heading={t('confirmDeliveryTitle', { item: deliveryTarget?.item.name ?? '' })}
        body={t('confirmDeliveryBody', {
          item: deliveryTarget?.item.name ?? '',
          name: userName(deliveryTarget?.ownerName),
        })}
        confirmLabel={t('confirmDelivery')}
        failedMessage={t('confirmDeliveryFailed')}
        status="warning"
        isOpen={deliveryTarget !== null}
        onOpenChange={open => {
          if (!open) setDeliveryTarget(null);
        }}
        onConfirm={confirmDelivery}
      />

      <Modal state={batchModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('batchTitle', { count: selected.size, decision })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="type-body text-soft">{t('batchHint', { decision })}</p>
                <TextField>
                  <Label>{t('noteLabel')}</Label>
                  <TextArea
                    variant="secondary"
                    rows={2}
                    placeholder={t('notePlaceholder')}
                    value={note}
                    onChange={event => setNote(event.target.value)}
                  />
                </TextField>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary" isDisabled={isProcessing}>
                  {t('cancel')}
                </Button>
                <Button variant={decision === 'approved' ? 'primary' : 'danger'} isPending={isProcessing} onPress={runBatch}>
                  {decision === 'approved' ? t('approveSelected', { count: selected.size }) : t('rejectSelected', { count: selected.size })}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
