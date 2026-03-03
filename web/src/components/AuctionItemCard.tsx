'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Avatar,
  Progress,
  Divider,
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
      return 'primary';
    case ItemRarity.RARE:
      return 'secondary';
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
}

const AuctionItemCard = ({
  item,
  onPlaceBid,
  isLoading = false,
  userBalance = 0,
}: AuctionItemCardProps) => {
  const router = useRouter();
  const t = useTranslations('auctionItemCard');
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [bidAmount, setBidAmount] = useState(item.currentBid + item.minBidIncrement);
  const [showBidHistory, setShowBidHistory] = useState(false);

  const isActive = item.status === AuctionStatus.ACTIVE;
  const isUpcoming = item.status === AuctionStatus.UPCOMING;

  const timeRemaining = formatTimeRemaining(item.endTime);
  const progress = getAuctionProgress(item.startTime, item.endTime);

  const canBid =
    isActive && bidAmount >= item.currentBid + item.minBidIncrement && bidAmount <= userBalance;

  const handlePlaceBid = () => {
    if (canBid) {
      onPlaceBid(item.id, bidAmount);
      onOpenChange();
    }
  };

  return (
    <>
      <Card
        isPressable
        onPress={() => router.push(`/dashboard/auction/${item.id}`)}
        className="border border-divider shadow-none bg-content1 hover:border-default-400 transition-colors"
      >
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-default-100">
                <Icon
                  icon={getCategoryIcon(item.category)}
                  width={20}
                  className="text-default-500"
                />
              </div>
              <div className="flex flex-col">
                <h4 className="text-base font-medium text-foreground">{item.name}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Chip size="sm" color={getRarityColor(item.rarity)} variant="flat">
                    {item.rarity.toUpperCase()}
                  </Chip>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Chip
                size="sm"
                color={isActive ? 'success' : isUpcoming ? 'warning' : 'default'}
                variant="flat"
              >
                {item.status.toUpperCase()}
              </Chip>
              {isActive && (
                <div className="flex items-center gap-1 text-xs text-default-400">
                  <Icon icon="solar:clock-circle-linear" width={12} />
                  <span>{timeRemaining}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <div className="space-y-4">
            <p className="text-sm text-default-500">{item.description}</p>

            {isActive && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-default-400">
                  <span>{t('timeRemaining')}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  color={progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success'}
                  size="sm"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-default-500">{t('currentBid')}</span>
                <span className="text-lg font-semibold text-foreground">
                  ${item.currentBid.toLocaleString()}
                </span>
              </div>

              {item.currentBidder && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-default-400">{t('leadingBidder')}</span>
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={item.currentBidder.avatar}
                      name={item.currentBidder.username}
                      size="sm"
                    />
                    <span className="text-sm text-foreground">{item.currentBidder.username}</span>
                  </div>
                </div>
              )}
            </div>

            <Divider />

            <div className="flex items-center justify-between">
              <span className="text-xs text-default-400">{t('soldBy')}</span>
              <div className="flex items-center gap-2">
                <Avatar src={item.seller.avatar} name={item.seller.username} size="sm" />
                <span className="text-sm text-foreground">{item.seller.username}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {isActive && (
                <Button color="primary" onPress={onOpen} isDisabled={isLoading} className="flex-1">
                  {t('placeBid')}
                </Button>
              )}
              <Button
                variant="flat"
                onPress={() => setShowBidHistory(true)}
                size="sm"
                startContent={<Icon icon="solar:history-linear" width={14} />}
              >
                {t('history')} ({item.bidHistory.length})
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Place Bid Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-2">
                  <Icon
                    icon={getCategoryIcon(item.category)}
                    width={18}
                    className="text-default-500"
                  />
                  <span>
                    {t('placeBidTitle')} {item.name}
                  </span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="bg-content2 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-default-500">{t('currentBid')}</span>
                      <span className="font-medium text-foreground">
                        ${item.currentBid.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-default-500">{t('minIncrement')}</span>
                      <span className="font-medium text-foreground">
                        ${item.minBidIncrement.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-default-500">{t('yourBalance')}</span>
                      <span className="font-medium text-foreground">
                        ${userBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <Input
                    type="number"
                    label={t('yourBidAmount')}
                    placeholder={`${t('minimum')} $${(item.currentBid + item.minBidIncrement).toLocaleString()}`}
                    value={bidAmount.toString()}
                    onChange={e => setBidAmount(Number(e.target.value))}
                    startContent={
                      <Icon
                        icon="solar:dollar-minimalistic-linear"
                        width={14}
                        className="text-default-400"
                      />
                    }
                    variant="bordered"
                    color={canBid ? 'success' : 'danger'}
                    description={
                      bidAmount > userBalance
                        ? t('insufficientBalance')
                        : bidAmount < item.currentBid + item.minBidIncrement
                          ? `${t('minimumBidIs')} $${(item.currentBid + item.minBidIncrement).toLocaleString()}`
                          : t('validBidAmount')
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  onPress={handlePlaceBid}
                  isDisabled={!canBid || isLoading}
                  isLoading={isLoading}
                >
                  {t('placeBid')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Bid History Modal */}
      <Modal
        isOpen={showBidHistory}
        onOpenChange={setShowBidHistory}
        size="2xl"
        scrollBehavior="inside"
        placement="top-center"
      >
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>
                {t('bidHistory')} {item.name}
              </ModalHeader>
              <ModalBody>
                <div className="space-y-2">
                  {item.bidHistory.length === 0 ? (
                    <div className="text-center py-8 text-default-400 text-sm">
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
                              : 'border-divider bg-content1'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar src={bid.bidder.avatar} name={bid.bidder.username} size="sm" />
                            <div>
                              <div className="text-sm font-medium text-foreground">
                                {bid.bidder.username}
                              </div>
                              <div className="text-xs text-default-400">
                                {new Date(bid.timestamp).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold text-foreground">
                              ${bid.amount.toLocaleString()}
                            </span>
                            {bid.isWinning && (
                              <Chip color="success" size="sm" variant="flat">
                                {t('leading')}
                              </Chip>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  {t('close')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default AuctionItemCard;
