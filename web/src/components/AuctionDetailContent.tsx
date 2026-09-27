'use client';

import {
  Button,
  Chip,
  Separator,
  Modal,
  useOverlayState,
  NumberField,
  ProgressBar,
  Label,
  Description,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { getRarityColor } from '@/components/ItemThumbnail';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useCountdown } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import { GOLD_FORMAT_OPTIONS, roundGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { auctionStatusColor } from '@/lib/status-colors';
import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory } from '@/types/item';
import { AsyncContent, DetailSkeleton } from './AsyncContent';
import { UserAvatar } from './UserAvatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ItemCategory, string> = {
  [ItemCategory.WEAPON]: 'tabler:sword',
  [ItemCategory.ARMOR]: 'solar:shield-check-linear',
  [ItemCategory.SKILL_SCROLL]: 'solar:book-2-linear',
  [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
  [ItemCategory.ACCESSORY]: 'solar:stars-linear',
  [ItemCategory.MATERIAL]: 'solar:box-linear',
  [ItemCategory.MISC]: 'solar:box-linear',
};

const getRemainingPercent = (now: number, startTime: string, endTime: string) => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const total = end - start;
  if (!(total > 0)) return now >= end ? 0 : 100;
  return Math.min(100, Math.max(0, ((end - now) / total) * 100));
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AuctionDetailContentProps {
  id: string;
  onClose?: () => void;
}

export default function AuctionDetailContent({ id, onClose }: AuctionDetailContentProps) {
  const router = useRouter();
  const guildId = useCurrentGuildId();
  const bidModalState = useOverlayState();
  const t = useTranslations('auctionItemPage');
  const labels = useTranslations('createAuctionModal');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const { balance: userBalance, refresh: refreshBalance } = useWalletBalance();
  const formatCountdown = useCountdownFormatter();

  const [item, setItem] = useState<AuctionItem | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const loadState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    loadState.reset();
    setReloadKey(key => key + 1);
  };
  const latestRequest = useRef(0);
  const refetchItem = () => {
    if (!id) return;
    const request = ++latestRequest.current;
    apiClient
      .getAuction(guildId, id)
      .then(next => {
        if (request !== latestRequest.current) return;
        setItem(next);
        setIsMissing(false);
        loadState.ready();
      })
      .catch(err => {
        if (request !== latestRequest.current) return;
        if (isNotFoundError(err)) {
          setItem(null);
          setIsMissing(true);
          return;
        }
        loadState.failed();
        notify.loadFailed(reload, 'auction-detail');
      });
  };
  useEffect(() => {
    refetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, id, reloadKey]);

  useLiveResource(['auction'], refetchItem, {
    guildId,
    match: event => event.resourceId === id,
  });

  const [bidInput, setBidInput] = useState<{ auctionId: string; amount: number } | null>(null);
  const { now, remainingMs, isExpired } = useCountdown(item?.endTime);

  if (isMissing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Icon icon="solar:ghost-linear" width={48} className="text-disabled" />
        <p className="text-subtle">{t('notFound')}</p>
        <Button variant="secondary" onPress={() => onClose ? onClose() : router.back()}>
          {t('goBack')}
        </Button>
      </div>
    );
  }

  if (!item) {
    return (
      <AsyncContent state={loadState.state} onRetry={reload} skeleton={<DetailSkeleton />}>
        {null}
      </AsyncContent>
    );
  }

  const minimumBid = roundGold(item.currentBid + item.minBidIncrement);
  const bidAmount = bidInput?.auctionId === id ? bidInput.amount : minimumBid;
  const isActive = item.status === AuctionStatus.ACTIVE;
  const timeRemaining = isExpired ? t('ended') : t('remaining', { time: formatCountdown(remainingMs) });
  const remainingPercent = getRemainingPercent(now, item.startTime, item.endTime);
  const hasBidAmount = Number.isFinite(bidAmount);
  const canBid = isActive && hasBidAmount && bidAmount >= minimumBid && bidAmount <= userBalance;

  const handlePlaceBid = async () => {
    if (!canBid) return;
    setIsLoading(true);
    try {
      await apiClient.placeBid(guildId, id, bidAmount);
      setBidInput(null);
      refetchItem();
      refreshBalance();
      bidModalState.close();
      notify.success(t('bidSuccess'));
    } catch {
      notify.error(t('bidFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const sortedHistory = [...item.bidHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-5">
      {/* Back button - only show in full page mode */}
      {!onClose && (
        <Button variant="secondary" size="sm" onPress={() => router.push('/dashboard/auction')}>
          <Icon icon="solar:arrow-left-linear" width={16} />
          {t('backToAuctions')}
        </Button>
      )}

      {/* Item header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-divider bg-surface">
        <div className="p-4 rounded-xl bg-default shrink-0">
          <Icon icon={CATEGORY_ICONS[item.category]} width={36} className="text-subtle" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip size="sm" color={getRarityColor(item.rarity)} variant="tertiary">
              {labels(`rarities.${item.rarity}`)}
            </Chip>
            <Chip size="sm" color={auctionStatusColor[item.status]} variant="tertiary">
              {t(`status.${item.status}`)}
            </Chip>
            {item.isBlind && (
              <Chip size="sm" color="accent" variant="tertiary">
                <Icon icon="solar:eye-closed-linear" width={12} />
                {t('blind')}
              </Chip>
            )}
          </div>
          <h1 className="type-title text-foreground">{item.name}</h1>
          <p className="type-body text-subtle mt-1">{item.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — bid info + history */}
        <div className="lg:col-span-3 space-y-4">
          {/* Auction status */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-4">
            <h2 className="type-subheading text-foreground">
              {t('auctionStatus')}
            </h2>

            {isActive && (
              <div className="space-y-2">
                <div className="flex justify-between type-caption text-hint">
                  <span>{t('timeRemaining')}</span>
                  <span className="font-medium text-foreground">{timeRemaining}</span>
                </div>
                <ProgressBar
                  aria-label={t('timeRemaining')}
                  className="w-full"
                  value={remainingPercent}
                  color={remainingPercent < 20 ? 'danger' : remainingPercent < 50 ? 'warning' : 'success'}
                  size="sm"
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 type-body">
              <div className="space-y-0.5">
                <p className="type-caption text-hint">{t('startTime')}</p>
                <p className="text-foreground">
                  {format.dateTime(new Date(item.startTime), { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="type-caption text-hint">{t('endTime')}</p>
                <p className="text-foreground">
                  {format.dateTime(new Date(item.endTime), { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          </div>

          {/* Bid section */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-4">
            <h2 className="type-subheading text-foreground">
              {t('bidding')}
            </h2>

            {item.isBlind ? (
              /* ── Blind auction ── */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-secondary border border-divider">
                  <Icon
                    icon="solar:eye-closed-linear"
                    width={20}
                    className="text-subtle shrink-0"
                  />
                  <div>
                    <p className="type-body font-medium text-foreground">{t('blindAuction')}</p>
                    <p className="type-caption text-subtle">{t('blindAuctionDesc')}</p>
                  </div>
                </div>
                <div className="flex justify-between type-body">
                  <span className="text-subtle">{t('startingBid')}</span>
                  <span className="font-semibold text-foreground">
                    {formatGold(item.startingBid)}
                  </span>
                </div>
                <div className="flex justify-between type-body">
                  <span className="text-subtle">{t('minIncrement')}</span>
                  <span className="font-semibold text-foreground">
                    {formatGold(item.minBidIncrement)}
                  </span>
                </div>
                {isActive && (
                  <Button
                    variant="primary"
                    fullWidth
                    onPress={bidModalState.open}
                    isDisabled={isLoading}
                  >
                    {t('submitBid')}
                  </Button>
                )}
              </div>
            ) : (
              /* ── Standard auction ── */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-subtle type-body">{t('currentBid')}</span>
                  <span className="type-display text-foreground">
                    {formatGold(item.currentBid)}
                  </span>
                </div>

                {item.currentBidder && (
                  <div className="flex items-center justify-between">
                    <span className="type-caption text-hint">{t('leadingBidder')}</span>
                    <div className="flex items-center gap-2">
                      <UserAvatar name={item.currentBidder.username} src={item.currentBidder.avatar} />
                      <span className="type-body text-foreground">{item.currentBidder.username}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 type-body">
                  <div className="p-3 rounded-lg bg-surface-secondary border border-divider space-y-0.5">
                    <p className="type-caption text-hint">{t('startingBid')}</p>
                    <p className="font-semibold text-foreground">
                      {formatGold(item.startingBid)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-secondary border border-divider space-y-0.5">
                    <p className="type-caption text-hint">{t('minIncrement')}</p>
                    <p className="font-semibold text-foreground">
                      {formatGold(item.minBidIncrement)}
                    </p>
                  </div>
                </div>

                {isActive && (
                  <Button
                    variant="primary"
                    fullWidth
                    onPress={bidModalState.open}
                    isDisabled={isLoading}
                  >
                    {t('placeBid')}
                  </Button>
                )}

                <Separator />

                {/* Bid history */}
                <div className="space-y-2">
                  <h3 className="type-label text-subtle">
                    {t('bidHistoryTitle', { count: item.bidHistory.length })}
                  </h3>
                  {sortedHistory.length === 0 ? (
                    <p className="type-body text-hint text-center py-4">{t('noBidsYet')}</p>
                  ) : (
                    sortedHistory.map(bid => (
                      <div
                        key={bid.id}
                        className={`flex justify-between items-center py-2.5 px-3 rounded-lg border ${
                          bid.isWinning
                            ? 'border-success/40 bg-success/5'
                            : 'border-divider bg-surface-secondary'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar name={bid.bidder.username} src={bid.bidder.avatar} />
                          <div>
                            <p className="type-body font-medium text-foreground">
                              {bid.bidder.username}
                            </p>
                            <p className="type-caption text-hint">
                              {format.dateTime(new Date(bid.timestamp), { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="type-subheading tabular-nums text-foreground">
                            {formatGold(bid.amount)}
                          </span>
                          {bid.isWinning && (
                            <Chip size="sm" color="success" variant="tertiary">
                              {t('leading')}
                            </Chip>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right column — seller + metadata */}
        <div className="lg:col-span-2 space-y-4">
          {/* Seller info */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-3">
            <h2 className="type-subheading text-foreground">
              {t('seller')}
            </h2>
            <div className="flex items-center gap-3">
              <UserAvatar name={item.seller.username} src={item.seller.avatar} size="md" />
              <div>
                <p className="font-medium text-foreground">{item.seller.username}</p>
                <p className="type-caption text-hint">{t('guildMember')}</p>
              </div>
            </div>
          </div>

          {/* Item metadata */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-3">
            <h2 className="type-subheading text-foreground">
              {t('itemDetails')}
            </h2>
            <div className="space-y-2 type-body">
              <div className="flex justify-between">
                <span className="text-hint">{t('category')}</span>
                <span className="text-foreground">{labels(`categories.${item.category}`)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-hint">{t('rarity')}</span>
                <Chip size="sm" color={getRarityColor(item.rarity)} variant="tertiary">
                  {labels(`rarities.${item.rarity}`)}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-hint">{t('auctionType')}</span>
                <span className="text-foreground">{item.isBlind ? t('blind') : t('standard')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-hint">{t('totalBids')}</span>
                <span className="text-foreground">{item.bidHistory.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-hint">{t('listed')}</span>
                <span className="text-foreground">
                  {format.dateTime(new Date(item.createdAt), { dateStyle: 'medium' })}
                </span>
              </div>
            </div>
          </div>

          {/* Your balance */}
          <div className="p-4 rounded-xl border border-divider bg-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-subtle">
                <Icon icon="solar:wallet-linear" width={16} />
                <span className="type-body">{t('yourBalance')}</span>
              </div>
              <span className="font-semibold text-foreground">
                {formatGold(userBalance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Bid Modal */}
      <Modal state={bidModalState}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="text-center items-center">
              <Modal.Heading>
                <div className="flex items-center gap-2">
                  <Icon
                    icon={CATEGORY_ICONS[item.category]}
                    width={18}
                    className="text-subtle"
                  />
                  <span>
                    {item.isBlind
                      ? t('submitBidTitle', { name: item.name })
                      : t('placeBidTitle', { name: item.name })}
                  </span>
                </div>
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1">
              <div className="space-y-4">
                <div className="bg-surface-secondary rounded-lg p-4 space-y-2">
                  {!item.isBlind && (
                    <div className="flex justify-between type-body">
                      <span className="text-subtle">{t('currentBid')}</span>
                      <span className="font-medium text-foreground">
                        {formatGold(item.currentBid)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between type-body">
                    <span className="text-subtle">{t('minIncrement')}</span>
                    <span className="font-medium text-foreground">
                      {formatGold(item.minBidIncrement)}
                    </span>
                  </div>
                  <div className="flex justify-between type-body">
                    <span className="text-subtle">{t('yourBalance')}</span>
                    <span className="font-medium text-foreground">
                      {formatGold(userBalance)}
                    </span>
                  </div>
                  {item.isBlind && (
                    <div className="flex items-center gap-2 pt-1 type-caption text-hint">
                      <Icon icon="solar:eye-closed-linear" width={12} />
                      <span>{t('blindAuctionNote')}</span>
                    </div>
                  )}
                </div>
                <NumberField
                  formatOptions={GOLD_FORMAT_OPTIONS}
                  minValue={minimumBid}
                  value={bidAmount}
                  onChange={value => setBidInput({ auctionId: id, amount: Number.isFinite(value) ? roundGold(value) : value })}
                  variant="secondary"
                >
                  <Label>{t('yourBidAmount')}</Label>
                  <NumberField.Group>
                    <NumberField.DecrementButton />
                    <NumberField.Input
                      className="w-full min-w-0"
                      placeholder={`${t('minimum')} ${formatGold(minimumBid)}`}
                    />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>
                    {bidAmount > userBalance
                      ? t('insufficientBalance')
                      : !hasBidAmount || bidAmount < minimumBid
                        ? `${t('minimumBidIs')} ${formatGold(minimumBid)}`
                        : t('validBidAmount')}
                  </Description>
                </NumberField>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" slot="close">
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handlePlaceBid}
                isDisabled={!canBid || isLoading}
                isPending={isLoading}
              >
                {item.isBlind ? t('submit') : t('placeBid')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
