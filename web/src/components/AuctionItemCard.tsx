'use client';

import { useState, useEffect } from 'react';
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
  Tooltip,
  Divider,
} from '@heroui/react';
import {
  ShieldCheckIcon,
  BookOpenIcon,
  BeakerIcon,
  CubeIcon,
  ClockIcon,
  UserIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import { AuctionItem, ItemCategory, ItemRarity, AuctionStatus, Bid } from '@/types/auction';

// Icon mapping for different item categories
const getCategoryIcon = (category: ItemCategory) => {
  const iconProps = { className: 'w-6 h-6' };
  
  switch (category) {
    case ItemCategory.WEAPON:
      return <WrenchScrewdriverIcon {...iconProps} />;
    case ItemCategory.ARMOR:
      return <ShieldCheckIcon {...iconProps} />;
    case ItemCategory.SKILL_SCROLL:
      return <BookOpenIcon {...iconProps} />;
    case ItemCategory.CONSUMABLE:
      return <BeakerIcon {...iconProps} />;
    case ItemCategory.ACCESSORY:
      return <SparklesIcon {...iconProps} />;
    case ItemCategory.MATERIAL:
    case ItemCategory.MISC:
    default:
      return <CubeIcon {...iconProps} />;
  }
};

// Rarity color mapping
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

// Format time remaining
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

// Calculate progress percentage for auction timer
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

const AuctionItemCard = ({ item, onPlaceBid, isLoading = false, userBalance = 0 }: AuctionItemCardProps) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [bidAmount, setBidAmount] = useState(item.currentBid + item.minBidIncrement);
  const [showBidHistory, setShowBidHistory] = useState(false);

  const isActive = item.status === AuctionStatus.ACTIVE;
  const isUpcoming = item.status === AuctionStatus.UPCOMING;
  const isEnded = item.status === AuctionStatus.ENDED;
  
  const timeRemaining = formatTimeRemaining(item.endTime);
  const progress = getAuctionProgress(item.startTime, item.endTime);
  
  const canBid = isActive && bidAmount >= (item.currentBid + item.minBidIncrement) && bidAmount <= userBalance;

  const handlePlaceBid = () => {
    if (canBid) {
      onPlaceBid(item.id, bidAmount);
      onOpenChange();
    }
  };

  return (
    <>
      <Card className="w-full hover:scale-105 transition-transform duration-200">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-default-100 dark:bg-default-50">
                {getCategoryIcon(item.category)}
              </div>
              <div className="flex flex-col">
                <h4 className="text-lg font-semibold">{item.name}</h4>
                <div className="flex items-center gap-2">
                  <Chip
                    size="sm"
                    color={getRarityColor(item.rarity)}
                    variant="flat"
                  >
                    {item.rarity.toUpperCase()}
                  </Chip>
                  <Chip size="sm" variant="bordered">
                    {item.category.replace('_', ' ').toUpperCase()}
                  </Chip>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Chip
                size="sm"
                color={isActive ? 'success' : isUpcoming ? 'warning' : 'default'}
                variant="flat"
              >
                {item.status.toUpperCase()}
              </Chip>
              {isActive && (
                <div className="flex items-center gap-1 mt-1 text-small text-default-500">
                  <ClockIcon className="w-4 h-4" />
                  <span>{timeRemaining}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <div className="space-y-4">
            {/* Description */}
            <p className="text-small text-default-600">{item.description}</p>

            {/* Progress bar for active auctions */}
            {isActive && (
              <div className="space-y-2">
                <div className="flex justify-between text-tiny text-default-500">
                  <span>Time Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  color={progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success'}
                  size="sm"
                />
              </div>
            )}

            {/* Current bid info */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-small font-medium">Current Bid:</span>
                <div className="flex items-center gap-1">
                  <CurrencyDollarIcon className="w-4 h-4 text-warning" />
                  <span className="text-lg font-bold text-warning">
                    {item.currentBid.toLocaleString()}
                  </span>
                </div>
              </div>

              {item.currentBidder && (
                <div className="flex items-center justify-between">
                  <span className="text-tiny text-default-500">Leading bidder:</span>
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={item.currentBidder.avatar}
                      name={item.currentBidder.username}
                      size="sm"
                    />
                    <span className="text-small">{item.currentBidder.username}</span>
                  </div>
                </div>
              )}
            </div>

            <Divider />

            {/* Seller info */}
            <div className="flex items-center justify-between">
              <span className="text-tiny text-default-500">Sold by:</span>
              <div className="flex items-center gap-2">
                <Avatar
                  src={item.seller.avatar}
                  name={item.seller.username}
                  size="sm"
                />
                <span className="text-small">{item.seller.username}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {isActive && (
                <Button
                  color="primary"
                  variant="solid"
                  onPress={onOpen}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Place Bid
                </Button>
              )}
              <Button
                color="default"
                variant="bordered"
                onPress={() => setShowBidHistory(true)}
                size="sm"
              >
                <UserIcon className="w-4 h-4" />
                Bid History ({item.bidHistory.length})
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Place Bid Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(item.category)}
                  Place Bid - {item.name}
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="bg-default-50 dark:bg-default-100 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Current Bid:</span>
                      <span className="font-semibold">${item.currentBid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Minimum Increment:</span>
                      <span className="font-semibold">${item.minBidIncrement.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Balance:</span>
                      <span className="font-semibold">${userBalance.toLocaleString()}</span>
                    </div>
                  </div>

                  <Input
                    type="number"
                    label="Your Bid Amount"
                    placeholder={`Minimum: $${(item.currentBid + item.minBidIncrement).toLocaleString()}`}
                    value={bidAmount.toString()}
                    onChange={(e) => setBidAmount(Number(e.target.value))}
                    startContent={<CurrencyDollarIcon className="w-4 h-4 text-default-400" />}
                    color={canBid ? 'success' : 'danger'}
                    description={
                      bidAmount > userBalance
                        ? 'Insufficient balance'
                        : bidAmount < (item.currentBid + item.minBidIncrement)
                        ? `Minimum bid is $${(item.currentBid + item.minBidIncrement).toLocaleString()}`
                        : 'Valid bid amount'
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handlePlaceBid}
                  disabled={!canBid || isLoading}
                  isLoading={isLoading}
                >
                  Place Bid
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
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Bid History - {item.name}
              </ModalHeader>
              <ModalBody>
                <div className="space-y-3">
                  {item.bidHistory.length === 0 ? (
                    <div className="text-center py-8 text-default-500">
                      No bids yet. Be the first to bid!
                    </div>
                  ) : (
                    item.bidHistory
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((bid) => (
                        <Card key={bid.id} className={bid.isWinning ? 'border-2 border-success' : ''}>
                          <CardBody className="py-3">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <Avatar
                                  src={bid.bidder.avatar}
                                  name={bid.bidder.username}
                                  size="sm"
                                />
                                <div>
                                  <div className="font-medium">{bid.bidder.username}</div>
                                  <div className="text-tiny text-default-500">
                                    {new Date(bid.timestamp).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold">
                                  ${bid.amount.toLocaleString()}
                                </span>
                                {bid.isWinning && (
                                  <Chip color="success" size="sm">
                                    Leading
                                  </Chip>
                                )}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      ))
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>
                  Close
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
