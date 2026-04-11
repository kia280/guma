'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  Chip,
  Button,
  Modal,
  Avatar,
  Separator,
  TextField,
  Label,
  InputGroup,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { AuctionItem, ItemCategory, ItemRarity, AuctionStatus } from '@/types/auction';

const getCategoryIcon = (category: ItemCategory) => {
  const icons: Record<ItemCategory, string> = {
    [ItemCategory.WEAPON]: 'solar:wrench-linear',
    [ItemCategory.ARMOR]: 'solar:shield-check-linear',
    [ItemCategory.SKILL_SCROLL]: 'solar:book-open-linear',
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

const formatTimeRemaining = (endTime: string) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) return 'Ended';

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
  onPlaceBid: (itemId: string, amount: number) => void;
  isLoading?: boolean;
  userBalance?: number;
  onCardClick?: (id: string) => void;
}

const AuctionItemCard = ({
  item,
  onPlaceBid,
  isLoading = false,
  userBalance = 0,
  onCardClick,
}: AuctionItemCardProps) => {
  const router = useRouter();
  const t = useTranslations('auctionItemCard');
  const [bidAmount, setBidAmount] = useState(item.currentBid + item.minBidIncrement);

  const isActive = item.status === AuctionStatus.ACTIVE;
  const isUpcoming = item.status === AuctionStatus.UPCOMING;

  const timeRemaining = formatTimeRemaining(item.endTime);
  const progress = getAuctionProgress(item.startTime, item.endTime);

  const canBid =
    isActive && bidAmount >= item.currentBid + item.minBidIncrement && bidAmount <= userBalance;

  const handlePlaceBid = () => {
    if (canBid) {
      onPlaceBid(item.id, bidAmount);
    }
  };

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(item.id);
    } else {
      router.push(`/dashboard/auction/${item.id}`);
    }
  };

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  const progressColor = progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success';

  return (
    <>
      <div
        className="border border-divider shadow-none bg-surface hover:border-default-400 transition-colors cursor-pointer rounded-lg"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
      >
        <Card className="border-0 shadow-none bg-transparent">
          <Card.Header className="pb-2">
            <div className="flex justify-between items-start w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-default-100">
                  <Icon
                    icon={getCategoryIcon(item.category)}
                    width={20}
                    className="text-foreground/50"
                  />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-base font-medium text-foreground">{item.name}</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Chip size="sm" color={getRarityColor(item.rarity)} variant="secondary">
                      {item.rarity.toUpperCase()}
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
                  {item.status.toUpperCase()}
                </Chip>
                {isActive && (
                  <div className="flex items-center gap-1 text-xs text-foreground/40">
                    <Icon icon="solar:clock-circle-linear" width={12} />
                    <span>{timeRemaining}</span>
                  </div>
                )}
              </div>
            </div>
          </Card.Header>

          <Card.Content className="pt-0">
            <div className="space-y-4">
              <p className="text-sm text-foreground/50">{item.description}</p>

              {isActive && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-foreground/40">
                    <span>{t('timeRemaining')}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-default-200 rounded-full overflow-hidden h-2">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${progress}%`,
                        backgroundColor:
                          progressColor === 'danger'
                            ? 'hsl(var(--heroui-danger))'
                            : progressColor === 'warning'
                              ? 'hsl(var(--heroui-warning))'
                              : 'hsl(var(--heroui-success))',
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-foreground/50">{t('currentBid')}</span>
                  <span className="text-lg font-semibold text-foreground">
                    ${item.currentBid.toLocaleString()}
                  </span>
                </div>

                {item.currentBidder && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground/40">{t('leadingBidder')}</span>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <Avatar.Image src={item.currentBidder.avatar} />
                        <Avatar.Fallback>
                          {item.currentBidder.username?.slice(0, 2).toUpperCase()}
                        </Avatar.Fallback>
                      </Avatar>
                      <span className="text-sm text-foreground">{item.currentBidder.username}</span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground/40">{t('soldBy')}</span>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <Avatar.Image src={item.seller.avatar} />
                    <Avatar.Fallback>
                      {item.seller.username?.slice(0, 2).toUpperCase()}
                    </Avatar.Fallback>
                  </Avatar>
                  <span className="text-sm text-foreground">{item.seller.username}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {isActive && (
                  <Modal>
                  <Button
                    variant="primary"
                    isDisabled={isLoading}
                    className="flex-1"
                  >
                    {t('placeBid')}
                  </Button>
                  {/* Place Bid Modal */}
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
                      className="text-foreground/50"
                    />
                    <span>
                      {t('placeBidTitle')} {item.name}
                    </span>
                  </div>
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-1">
                <div className="space-y-4">
                  <div className="bg-surface-secondary rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/50">{t('currentBid')}</span>
                      <span className="font-medium text-foreground">
                        ${item.currentBid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/50">{t('minIncrement')}</span>
                      <span className="font-medium text-foreground">
                        ${item.minBidIncrement.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-foreground/50">{t('yourBalance')}</span>
                      <span className="font-medium text-foreground">
                        ${userBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <TextField>
                    <Label>{t('yourBidAmount')}</Label>
                    <InputGroup>
                      <InputGroup.Prefix>
                        <Icon
                          icon="solar:dollar-minimalistic-linear"
                          width={14}
                          className="text-foreground/40"
                        />
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type="number"
                        placeholder={`${t('minimum')} $${(item.currentBid + item.minBidIncrement).toLocaleString()}`}
                        value={bidAmount.toString()}
                        onChange={e => setBidAmount(Number(e.target.value))}
                      />
                    </InputGroup>
                    <p className="text-xs text-foreground/40 mt-1">
                      {bidAmount > userBalance
                        ? t('insufficientBalance')
                        : bidAmount < item.currentBid + item.minBidIncrement
                          ? `${t('minimumBidIs')} $${(item.currentBid + item.minBidIncrement).toLocaleString()}`
                          : t('validBidAmount')}
                    </p>
                  </TextField>
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
                )}
                <Modal>
                <Button variant="secondary" size="sm">
                  <Icon icon="solar:history-linear" width={14} />
                  {t('history')} ({item.bidHistory.length})
                </Button>
                {/* Bid History Modal */}
                <Modal.Backdrop>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header className="text-center items-center">
                <Modal.Heading>
                  {t('bidHistory')} {item.name}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="p-1">
                <div className="space-y-2 overflow-y-auto max-h-[60vh]">
                  {item.bidHistory.length === 0 ? (
                    <div className="text-center py-8 text-foreground/40 text-sm">
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
                              <div className="text-sm font-medium text-foreground">
                                {bid.bidder.username}
                              </div>
                              <div className="text-xs text-foreground/40">
                                {new Date(bid.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-foreground">
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
