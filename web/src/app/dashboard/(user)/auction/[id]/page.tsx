'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Chip,
  Avatar,
  Divider,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  useDisclosure,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { AuctionItem, ItemCategory, ItemRarity, AuctionStatus, Bid } from '@/types/auction';
import { useTranslations } from 'next-intl';

// ─── Shared mock data (same as AuctionPage.tsx) ───────────────────────────────

const mockAuctionItems: AuctionItem[] = [
  {
    id: '1',
    name: 'Dragon Slayer Sword',
    description: 'A legendary blade forged from dragon scales. Increases critical hit rate by 25%.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.LEGENDARY,
    startingBid: 1000,
    currentBid: 2500,
    currentBidder: { id: 'user1', username: 'DragonHunter' },
    minBidIncrement: 100,
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: 'seller1',
    seller: { id: 'seller1', username: 'GuildMaster' },
    bidHistory: [
      {
        id: 'bid1',
        auctionItemId: '1',
        bidderId: 'user2',
        bidder: { id: 'user2', username: 'Warrior123' },
        amount: 1000,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isWinning: false,
      },
      {
        id: 'bid2',
        auctionItemId: '1',
        bidderId: 'user1',
        bidder: { id: 'user1', username: 'DragonHunter' },
        amount: 2500,
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        isWinning: true,
      },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    name: 'Mystic Shield of Protection',
    description: 'An enchanted shield that provides magical protection and reflects 15% damage.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.EPIC,
    startingBid: 800,
    currentBid: 800,
    minBidIncrement: 50,
    startTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: 'seller2',
    seller: { id: 'seller2', username: 'Enchanter' },
    bidHistory: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    name: 'Ancient Healing Scroll',
    description: 'A powerful healing spell that restores 80% of maximum health instantly.',
    category: ItemCategory.SKILL_SCROLL,
    rarity: ItemRarity.RARE,
    startingBid: 500,
    currentBid: 750,
    currentBidder: { id: 'user3', username: 'Healer' },
    minBidIncrement: 25,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.UPCOMING,
    guildId: 'guild1',
    sellerId: 'seller3',
    seller: { id: 'seller3', username: 'ScrollMaster' },
    bidHistory: [
      {
        id: 'bid3',
        auctionItemId: '3',
        bidderId: 'user3',
        bidder: { id: 'user3', username: 'Healer' },
        amount: 750,
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        isWinning: true,
      },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    name: 'Rare Mithril Ore',
    description: 'High-quality crafting material used to forge superior weapons and armor.',
    category: ItemCategory.MATERIAL,
    rarity: ItemRarity.UNCOMMON,
    startingBid: 200,
    currentBid: 350,
    currentBidder: { id: 'user4', username: 'Blacksmith' },
    minBidIncrement: 25,
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: AuctionStatus.ENDED,
    guildId: 'guild1',
    sellerId: 'seller4',
    seller: { id: 'seller4', username: 'Miner' },
    bidHistory: [
      {
        id: 'bid4',
        auctionItemId: '4',
        bidderId: 'user4',
        bidder: { id: 'user4', username: 'Blacksmith' },
        amount: 350,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isWinning: true,
      },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    name: 'Shadow Cloak of the Assassin',
    description:
      'A mysterious cloak that conceals the wearer in darkness. Details hidden until auction ends.',
    category: ItemCategory.ARMOR,
    rarity: ItemRarity.MYTHIC,
    isBlind: true,
    startingBid: 3000,
    currentBid: 3000,
    minBidIncrement: 200,
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: 'seller1',
    seller: { id: 'seller1', username: 'GuildMaster' },
    bidHistory: [],
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<ItemCategory, string> = {
  [ItemCategory.WEAPON]: 'solar:wrench-linear',
  [ItemCategory.ARMOR]: 'solar:shield-check-linear',
  [ItemCategory.SKILL_SCROLL]: 'solar:book-open-linear',
  [ItemCategory.CONSUMABLE]: 'solar:test-tube-linear',
  [ItemCategory.ACCESSORY]: 'solar:stars-linear',
  [ItemCategory.MATERIAL]: 'solar:box-linear',
  [ItemCategory.MISC]: 'solar:box-linear',
};

const RARITY_COLOR: Record<
  ItemRarity,
  'default' | 'primary' | 'secondary' | 'warning' | 'danger' | 'success'
> = {
  [ItemRarity.COMMON]: 'default',
  [ItemRarity.UNCOMMON]: 'primary',
  [ItemRarity.RARE]: 'secondary',
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

const USER_BALANCE = 5000;

export default function AuctionItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const t = useTranslations('auctionItemPage');

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

  const [item, setItem] = useState<AuctionItem | null>(
    () => mockAuctionItems.find(i => i.id === id) ?? null
  );
  const [bidAmount, setBidAmount] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

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

  // Reset bid amount when item changes
  useEffect(() => {
    if (item) setBidAmount(item.currentBid + item.minBidIncrement);
  }, [item]);

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Icon icon="solar:ghost-linear" width={48} className="text-default-300" />
        <p className="text-default-500">{t('notFound')}</p>
        <Button variant="flat" onPress={() => router.back()}>
          {t('goBack')}
        </Button>
      </div>
    );
  }

  const isActive = item.status === AuctionStatus.ACTIVE;
  const canBid =
    isActive && bidAmount >= item.currentBid + item.minBidIncrement && bidAmount <= USER_BALANCE;

  const handlePlaceBid = () => {
    if (!canBid) return;
    setIsLoading(true);
    setTimeout(() => {
      setItem(prev => {
        if (!prev) return prev;
        const newBid: Bid = {
          id: `bid-${Date.now()}`,
          auctionItemId: prev.id,
          bidderId: 'current-user',
          bidder: { id: 'current-user', username: 'You' },
          amount: bidAmount,
          timestamp: new Date().toISOString(),
          isWinning: true,
        };
        return {
          ...prev,
          currentBid: bidAmount,
          currentBidder: { id: 'current-user', username: 'You' },
          bidHistory: [...prev.bidHistory.map(b => ({ ...b, isWinning: false })), newBid],
          updatedAt: new Date().toISOString(),
        };
      });
      setBidAmount(prev => prev + item.minBidIncrement);
      setIsLoading(false);
      onOpenChange();
    }, 800);
  };

  const sortedHistory = [...item.bidHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="flat"
        size="sm"
        startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
        onPress={() => router.push('/dashboard/auction')}
      >
        {t('backToAuctions')}
      </Button>

      {/* Item header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-divider bg-content1">
        <div className="p-4 rounded-xl bg-default-100 shrink-0">
          <Icon icon={CATEGORY_ICONS[item.category]} width={36} className="text-default-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip size="sm" color={RARITY_COLOR[item.rarity]} variant="flat">
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
              variant="flat"
            >
              {item.status.toUpperCase()}
            </Chip>
            {item.isBlind && (
              <Chip
                size="sm"
                color="secondary"
                variant="flat"
                startContent={<Icon icon="solar:eye-closed-linear" width={12} />}
              >
                BLIND
              </Chip>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{item.name}</h1>
          <p className="text-sm text-default-500 mt-1">{item.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — bid info + history */}
        <div className="lg:col-span-3 space-y-4">
          {/* Auction status */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-4">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('auctionStatus')}
            </h2>

            {isActive && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-default-400">
                  <span>{t('timeElapsed')}</span>
                  <span className="font-medium text-foreground">
                    {timeRemaining} {t('remaining')}
                  </span>
                </div>
                <Progress
                  value={progress}
                  color={progress > 80 ? 'danger' : progress > 50 ? 'warning' : 'success'}
                  size="sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-default-400">{t('startTime')}</p>
                <p className="text-foreground">{new Date(item.startTime).toLocaleString()}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-default-400">{t('endTime')}</p>
                <p className="text-foreground">{new Date(item.endTime).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Bid section */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-4">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('bidding')}
            </h2>

            {item.isBlind ? (
              /* ── Blind auction ── */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-default-50 border border-divider">
                  <Icon
                    icon="solar:eye-closed-linear"
                    width={20}
                    className="text-secondary shrink-0"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{t('blindAuction')}</p>
                    <p className="text-xs text-default-500">{t('blindAuctionDesc')}</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">{t('startingBid')}</span>
                  <span className="font-semibold text-foreground">
                    ${item.startingBid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">{t('minIncrement')}</span>
                  <span className="font-semibold text-foreground">
                    ${item.minBidIncrement.toLocaleString()}
                  </span>
                </div>
                {isActive && (
                  <Button color="primary" fullWidth onPress={onOpen} isDisabled={isLoading}>
                    {t('submitBid')}
                  </Button>
                )}
              </div>
            ) : (
              /* ── Standard auction ── */
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-default-500 text-sm">{t('currentBid')}</span>
                  <span className="text-2xl font-bold text-foreground">
                    ${item.currentBid.toLocaleString()}
                  </span>
                </div>

                {item.currentBidder && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-default-400">{t('leadingBidder')}</span>
                    <div className="flex items-center gap-2">
                      <Avatar name={item.currentBidder.username} size="sm" />
                      <span className="text-sm text-foreground">{item.currentBidder.username}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-default-50 border border-divider space-y-0.5">
                    <p className="text-xs text-default-400">{t('startingBid')}</p>
                    <p className="font-semibold text-foreground">
                      ${item.startingBid.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-default-50 border border-divider space-y-0.5">
                    <p className="text-xs text-default-400">{t('minIncrement')}</p>
                    <p className="font-semibold text-foreground">
                      ${item.minBidIncrement.toLocaleString()}
                    </p>
                  </div>
                </div>

                {isActive && (
                  <Button color="primary" fullWidth onPress={onOpen} isDisabled={isLoading}>
                    {t('placeBid')}
                  </Button>
                )}

                <Divider />

                {/* Bid history */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-default-500 uppercase tracking-wide">
                    {t('bidHistoryTitle')} ({item.bidHistory.length})
                  </h3>
                  {sortedHistory.length === 0 ? (
                    <p className="text-sm text-default-400 text-center py-4">{t('noBidsYet')}</p>
                  ) : (
                    sortedHistory.map(bid => (
                      <div
                        key={bid.id}
                        className={`flex justify-between items-center py-2.5 px-3 rounded-lg border ${
                          bid.isWinning
                            ? 'border-success/40 bg-success/5'
                            : 'border-divider bg-content2'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar name={bid.bidder.username} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {bid.bidder.username}
                            </p>
                            <p className="text-xs text-default-400">
                              {new Date(bid.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-semibold text-foreground">
                            ${bid.amount.toLocaleString()}
                          </span>
                          {bid.isWinning && (
                            <Chip size="sm" color="success" variant="flat">
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
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-3">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('seller')}
            </h2>
            <div className="flex items-center gap-3">
              <Avatar name={item.seller.username} size="md" />
              <div>
                <p className="font-medium text-foreground">{item.seller.username}</p>
                <p className="text-xs text-default-400">{t('guildMember')}</p>
              </div>
            </div>
          </div>

          {/* Item metadata */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-3">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('itemDetails')}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-default-400">{t('category')}</span>
                <span className="text-foreground capitalize">
                  {item.category.replace('_', ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('rarity')}</span>
                <Chip size="sm" color={RARITY_COLOR[item.rarity]} variant="flat">
                  {item.rarity.toUpperCase()}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('auctionType')}</span>
                <span className="text-foreground">{item.isBlind ? t('blind') : t('standard')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('totalBids')}</span>
                <span className="text-foreground">{item.bidHistory.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('listed')}</span>
                <span className="text-foreground">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Your balance */}
          <div className="p-4 rounded-xl border border-divider bg-content1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-default-500">
                <Icon icon="solar:wallet-linear" width={16} />
                <span className="text-sm">{t('yourBalance')}</span>
              </div>
              <span className="font-semibold text-foreground">
                ${USER_BALANCE.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Place Bid Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-2">
                  <Icon
                    icon={CATEGORY_ICONS[item.category]}
                    width={18}
                    className="text-default-500"
                  />
                  <span>
                    {item.isBlind ? t('submitBid') : t('placeBid')} — {item.name}
                  </span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div className="bg-content2 rounded-lg p-4 space-y-2">
                    {!item.isBlind && (
                      <div className="flex justify-between text-sm">
                        <span className="text-default-500">{t('currentBid')}</span>
                        <span className="font-medium text-foreground">
                          ${item.currentBid.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-default-500">{t('minIncrement')}</span>
                      <span className="font-medium text-foreground">
                        ${item.minBidIncrement.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-default-500">{t('yourBalance')}</span>
                      <span className="font-medium text-foreground">
                        ${USER_BALANCE.toLocaleString()}
                      </span>
                    </div>
                    {item.isBlind && (
                      <div className="flex items-center gap-2 pt-1 text-xs text-secondary">
                        <Icon icon="solar:eye-closed-linear" width={12} />
                        <span>{t('blindAuctionNote')}</span>
                      </div>
                    )}
                  </div>
                  <Input
                    type="number"
                    label={t('yourBidAmount')}
                    placeholder={`Minimum: $${(item.currentBid + item.minBidIncrement).toLocaleString()}`}
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
                      bidAmount > USER_BALANCE
                        ? t('insufficientBalance')
                        : bidAmount < item.currentBid + item.minBidIncrement
                          ? `${t('minimumBidIs')}${(item.currentBid + item.minBidIncrement).toLocaleString()}`
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
                  {item.isBlind ? t('submit') : t('placeBid')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
