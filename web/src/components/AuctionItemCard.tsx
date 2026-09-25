'use client';

import {
  Card,
  Chip,
  Button,
  Modal,
  Avatar,
  Separator,
  NumberField,
  Label,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { GOLD_FORMAT_OPTIONS, roundGold } from '@/lib/guma/money';
import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';

const PROGRESS_FILL = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
} as const;

const getCategoryIcon = (category: ItemCategory) => {
  const icons: Record<ItemCategory, string> = {
    [ItemCategory.WEAPON]: 'tabler:sword',
    [ItemCategory.ARMOR]: 'solar:shield-check-linear',
    [ItemCategory.SKILL_SCROLL]: 'solar:book-2-linear',
    [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
    [ItemCategory.ACCESSORY]: 'solar:stars-linear',
    [ItemCategory.MATERIAL]: 'solar:box-linear',
    [ItemCategory.MISC]: 'solar:box-linear',
  };
  return icons[category] ?? 'solar:box-linear';
};

const getRarityColor = (rarity: ItemRarity) => {
  switch (rarity) {
    case ItemRarity.COMMON:
      return 'default';
    case ItemRarity.UNCOMMON:
      return 'accent';
    case ItemRarity.RARE:
      return 'default';
    case ItemRarity.EPIC:
      return 'warning';
    case ItemRarity.LEGENDARY:
      return 'danger';
    case ItemRarity.MYTHIC:
      return 'success';
    default:
      return 'default';
  }
};

const formatTimeRemaining = (endTime: string, endedLabel: string) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return endedLabel;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const getAuctionProgress = (startTime: string, endTime: string) => {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

  return Math.min(100, Math.max(0, (elapsed / total) * 100));
};

interface AuctionItemCardProps {
  item: AuctionItem;
  onPlaceBid: (itemId: string, amount: number) => Promise<boolean>;
  isLoading?: boolean;
  userBalance?: number;
}

const AuctionItemCard = ({
  item,
  onPlaceBid,
  isLoading = false,
  userBalance = 0,
}: AuctionItemCardProps) => {
  const t = useTranslations('auctionItemCard');
  const labels = useTranslations('createAuctionModal');
  const format = useIntlFormatter();
  const [bidInput, setBidInput] = useState<number | null>(null);
  const minimumBid = roundGold(item.currentBid + item.minBidIncrement);
  const bidAmount = bidInput ?? minimumBid;

  const isActive = item.status === AuctionStatus.ACTIVE;
  const isUpcoming = item.status === AuctionStatus.UPCOMING;

  const timeRemaining = formatTimeRemaining(item.endTime, t('ended'));
  const progress = getAuctionProgress(item.startTime, item.endTime);

  const hasBidAmount = Number.isFinite(bidAmount);
  const canBid = isActive && hasBidAmount && bidAmount >= minimumBid && bidAmount <= userBalance;

  const bidModal = useOverlayState();

  const handlePlaceBid = async () => {
    if (!canBid) return;
    if (await onPlaceBid(item.id, bidAmount)) {
      setBidInput(null);
      bidModal.close();
    }
  };

  const progressColor = progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success';

  return (
    <>
      <div
        className="relative border border-divider shadow-none bg-surface hover:border-foreground/20 transition-colors rounded-lg"
      >
        <Card className="border-0 shadow-none bg-transparent">
          <Card.Header className="pb-2">
            <div className="flex justify-between items-start w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-default">
                  <Icon
                    icon={getCategoryIcon(item.category)}
                    width={20}
                    className="text-subtle"
                  />
                </div>
                <div className="flex flex-col">
                  <h4 className="type-subheading text-foreground">
                    <Link
                      href={`/dashboard/auction/${item.id}`}
                      className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                    >
                      {item.name}
                    </Link>
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Chip size="sm" color={getRarityColor(item.rarity)} variant="secondary">
                      {labels(`rarities.${item.rarity}`)}
                    </Chip>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Chip
                  size="sm"
                  color={isActive ? 'success' : isUpcoming ? 'warning' : 'default'}
                  variant="secondary"
                >
                  {t(`status.${item.status}`)}
                </Chip>
                {isActive && (
                  <div className="flex items-center gap-1 type-caption text-hint">
                    <Icon icon="solar:clock-circle-linear" width={12} />
                    <span>{timeRemaining}</span>
                  </div>
                )}
              </div>
            </div>
          </Card.Header>

          <Card.Content className="pt-0">
            <div className="space-y-4">
              <p className="type-body text-subtle">{item.description}</p>

              {isActive && (
                <div className="space-y-1.5">
                  <div className="flex justify-between type-caption text-hint">
                    <span>{t('timeRemaining')}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-default rounded-full overflow-hidden h-2">
                    <div
                      className={`h-full transition-all ${PROGRESS_FILL[progressColor]}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="type-body text-subtle">{t('currentBid')}</span>
                  <span className="type-heading tabular-nums text-foreground">
                    ${item.currentBid.toLocaleString()}
                  </span>
                </div>

                {item.currentBidder && (
                  <div className="flex items-center justify-between">
                    <span className="type-caption text-hint">{t('leadingBidder')}</span>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <Avatar.Image src={item.currentBidder.avatar} />
                        <Avatar.Fallback>
                          {item.currentBidder.username?.slice(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <span className="type-body text-foreground">{item.currentBidder.username}</span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="type-caption text-hint">{t('soldBy')}</span>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <Avatar.Image src={item.seller.avatar} />
                    <Avatar.Fallback>
                      {item.seller.username?.slice(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="type-body text-foreground">{item.seller.username}</span>
                </div>
              </div>

              <div className="relative z-10 flex gap-2">
                {isActive && (
                  <>
                  <Button
                    variant="primary"
                    isDisabled={isLoading}
                    className="flex-1"
                    onPress={bidModal.open}
                  >
                    {t('placeBid')}
                  </Button>
                  {/* Place Bid Modal */}
                  <Modal state={bidModal}>
                  <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="text-center items-center">
                <Modal.Heading>
                  <div className="flex items-center gap-2">
                    <Icon
                      icon={getCategoryIcon(item.category)}
                      width={18}
                      className="text-subtle"
                    />
                    <span>{t('placeBidTitle', { name: item.name })}</span>
                  </div>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-1">
                <div className="space-y-4">
                  <div className="bg-surface-secondary rounded-lg p-4 space-y-2">
                    <div className="flex justify-between type-body">
                      <span className="text-subtle">{t('currentBid')}</span>
                      <span className="font-medium text-foreground">
                        ${item.currentBid.toLocaleString()}
                      </span>
                    </div>
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
                  </div>

                  <NumberField
                    formatOptions={GOLD_FORMAT_OPTIONS}
                    minValue={minimumBid}
                    value={bidAmount}
                    onChange={value => setBidInput(Number.isFinite(value) ? roundGold(value) : value)}
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
                    <p className="type-caption text-hint mt-1">
                      {bidAmount > userBalance
                        ? t('insufficientBalance')
                        : !hasBidAmount || bidAmount < minimumBid
                          ? `${t('minimumBidIs')} $${minimumBid.toLocaleString()}`
                          : t('validBidAmount')}
                    </p>
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
                  {t('placeBid')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
      </Modal.Backdrop>
      </Modal>
                  </>
                )}
                <Modal>
                <Button variant="secondary" size="sm">
                  <Icon icon="solar:history-linear" width={14} />
                  {t('history', { count: item.bidHistory.length })}
                </Button>
                {/* Bid History Modal */}
                <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="text-center items-center">
                <Modal.Heading>{t('bidHistory', { name: item.name })}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-1">
                <div className="space-y-2 overflow-y-auto max-h-[60vh]">
                  {item.bidHistory.length === 0 ? (
                    <div className="text-center py-8 text-hint type-body">
                      {t('noBidsYet')}
                    </div>
                  ) : (
                    item.bidHistory
                      .sort(
                        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                      )
                      .map(bid => (
                        <div
                          key={bid.id}
                          className={`flex justify-between items-center py-3 px-4 rounded-lg border ${
                            bid.isWinning
                              ? 'border-success/40 bg-success/5'
                              : 'border-divider bg-surface'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar size="sm">
                              <Avatar.Image src={bid.bidder.avatar} />
                              <Avatar.Fallback>
                                {bid.bidder.username?.slice(0, 2).toUpperCase()}
                              </Avatar.Fallback>
                            </Avatar>
                            <div>
                              <div className="type-body font-medium text-foreground">
                                {bid.bidder.username}
                              </div>
                              <div className="type-caption text-hint">
                                {format.dateTime(new Date(bid.timestamp), { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="type-subheading tabular-nums text-foreground">
                              ${bid.amount.toLocaleString()}
                            </span>
                            {bid.isWinning && (
                              <Chip color="success" size="sm" variant="secondary">
                                {t('leading')}
                              </Chip>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" slot="close">
                  {t('close')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
      </Modal.Backdrop>
      </Modal>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    </>
  );
};

export default AuctionItemCard;
