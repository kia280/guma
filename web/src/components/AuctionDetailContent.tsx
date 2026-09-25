'use client';

import {
  Button,
  Chip,
  Avatar,
  Separator,
  Modal,
  useOverlayState,
  NumberField,
  ProgressBar,
  Label,
  Description,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GOLD_FORMAT_OPTIONS, roundGold } from '@/lib/guma/money';
import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';

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

const RARITY_COLOR: Record<ItemRarity, 'default' | 'accent' | 'success' | 'warning' | 'danger'> = {
  [ItemRarity.COMMON]: 'default',
  [ItemRarity.UNCOMMON]: 'accent',
  [ItemRarity.RARE]: 'success',
  [ItemRarity.EPIC]: 'warning',
  [ItemRarity.LEGENDARY]: 'danger',
  [ItemRarity.MYTHIC]: 'success',
};

const getProgress = (startTime: string, endTime: string) => {
  const total = new Date(endTime).getTime() - new Date(startTime).getTime();
  const elapsed = Date.now() - new Date(startTime).getTime();
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
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
  const { balance: userBalance, refresh: refreshBalance } = useWalletBalance();

  const formatTimeRemaining = (endTime: string) => {
    const diff = new Date(endTime).getTime() - Date.now();
    if (diff <= 0) return t('ended');
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const [item, setItem] = useState<AuctionItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const latestRequest = useRef(0);
  const refetchItem = (background = false) => {
    if (!id) return;
    const request = ++latestRequest.current;
    apiClient
      .getAuction(guildId, id)
      .then(next => {
        if (request === latestRequest.current) setItem(next);
      })
      .catch(err => {
        if (request !== latestRequest.current) return;
        if (!background || (isAxiosError(err) && err.response?.status === 404)) setItem(null);
      });
  };
  useEffect(() => {
    refetchItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, id]);

  useLiveResource(['auction'], () => refetchItem(true), {
    guildId,
    match: event => event.resourceId === id,
  });

  const [bidInput, setBidInput] = useState<{ auctionId: string; amount: number } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [progress, setProgress] = useState(0);

  // Live countdown
  useEffect(() => {
    if (!item) return;
    const tick = () => {
      setTimeRemaining(formatTimeRemaining(item.endTime));
      setProgress(getProgress(item.startTime, item.endTime));
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, [item]);

  if (!item) {
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

  const minimumBid = roundGold(item.currentBid + item.minBidIncrement);
  const bidAmount = bidInput?.auctionId === id ? bidInput.amount : minimumBid;
  const isActive = item.status === AuctionStatus.ACTIVE;
  const hasBidAmount = Number.isFinite(bidAmount);
  const canBid = isActive && hasBidAmount && bidAmount >= minimumBid && bidAmount <= userBalance;

  const handlePlaceBid = async () => {
    if (!canBid) return;
    setIsLoading(true);
    try {
      await apiClient.placeBid(guildId, id, bidAmount);
      setBidInput(null);
      refetchItem(true);
      refreshBalance();
      bidModalState.close();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const sortedHistory = [...item.bidHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <>
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
            <Chip size="sm" color={RARITY_COLOR[item.rarity]} variant="tertiary">
              {item.rarity.toUpperCase()}
            </Chip>
            <Chip
              size="sm"
              color={
                isActive
                  ? 'success'
                  : item.status === AuctionStatus.UPCOMING
                    ? 'warning'
                    : 'default'
              }
              variant="tertiary"
            >
              {item.status.toUpperCase()}
            </Chip>
            {item.isBlind && (
              <Chip size="sm" color="accent" variant="tertiary">
                <Icon icon="solar:eye-closed-linear" width={12} />
                BLIND
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
                  <span>{t('timeElapsed')}</span>
                  <span className="font-medium text-foreground">
                    {timeRemaining} {t('remaining')}
                  </span>
                </div>
                <ProgressBar
                  value={progress}
                  color={progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success'}
                  size="sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 type-body">
              <div className="space-y-0.5">
                <p className="type-caption text-hint">{t('startTime')}</p>
                <p className="text-foreground">{new Date(item.startTime).toLocaleString()}</p>
              </div>
              <div className="space-y-0.5">
                <p className="type-caption text-hint">{t('endTime')}</p>
                <p className="text-foreground">{new Date(item.endTime).toLocaleString()}</p>
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
                    ${item.startingBid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between type-body">
                  <span className="text-subtle">{t('minIncrement')}</span>
                  <span className="font-semibold text-foreground">
                    ${item.minBidIncrement.toLocaleString()}
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
                    ${item.currentBid.toLocaleString()}
                  </span>
                </div>

                {item.currentBidder && (
                  <div className="flex items-center justify-between">
                    <span className="type-caption text-hint">{t('leadingBidder')}</span>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <Avatar.Fallback>
                          {item.currentBidder.username.slice(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <span className="type-body text-foreground">{item.currentBidder.username}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 type-body">
                  <div className="p-3 rounded-lg bg-surface-secondary border border-divider space-y-0.5">
                    <p className="type-caption text-hint">{t('startingBid')}</p>
                    <p className="font-semibold text-foreground">
                      ${item.startingBid.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-secondary border border-divider space-y-0.5">
                    <p className="type-caption text-hint">{t('minIncrement')}</p>
                    <p className="font-semibold text-foreground">
                      ${item.minBidIncrement.toLocaleString()}
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
                    {t('bidHistoryTitle')} ({item.bidHistory.length})
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
                          <Avatar size="sm">
                            <Avatar.Fallback>
                              {bid.bidder.username.slice(0, 2).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar>
                          <div>
                            <p className="type-body font-medium text-foreground">
                              {bid.bidder.username}
                            </p>
                            <p className="type-caption text-hint">
                              {new Date(bid.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="type-subheading tabular-nums text-foreground">
                            ${bid.amount.toLocaleString()}
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
              <Avatar size="md">
                <Avatar.Fallback>{item.seller.username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
              </Avatar>
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
                <span className="text-foreground capitalize">
                  {item.category.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-hint">{t('rarity')}</span>
                <Chip size="sm" color={RARITY_COLOR[item.rarity]} variant="tertiary">
                  {item.rarity.toUpperCase()}
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
                  {new Date(item.createdAt).toLocaleDateString()}
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
                ${userBalance.toLocaleString()}
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
                    {item.isBlind ? t('submitBid') : t('placeBid')} — {item.name}
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
                        ${item.currentBid.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between type-body">
                    <span className="text-subtle">{t('minIncrement')}</span>
                    <span className="font-medium text-foreground">
                      ${item.minBidIncrement.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between type-body">
                    <span className="text-subtle">{t('yourBalance')}</span>
                    <span className="font-medium text-foreground">
                      ${userBalance.toLocaleString()}
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
                      placeholder={`${t('minimum')} $${minimumBid.toLocaleString()}`}
                    />
                    <NumberField.IncrementButton />
                  </NumberField.Group>
                  <Description>
                    {bidAmount > userBalance
                      ? t('insufficientBalance')
                      : !hasBidAmount || bidAmount < minimumBid
                        ? `${t('minimumBidIs')}${minimumBid.toLocaleString()}`
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
    </>
  );
}
