'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, Select, SelectItem, Input, Tabs, Tab, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import AuctionItemCard from '@/components/AuctionItemCard';
import { AuctionItem, ItemCategory, ItemRarity, AuctionStatus } from '@/types/auction';

const mockAuctionItems: AuctionItem[] = [
  {
    id: '1',
    name: 'Dragon Slayer Sword',
    description: 'A legendary blade forged from dragon scales. Increases critical hit rate by 25%.',
    category: ItemCategory.WEAPON,
    rarity: ItemRarity.LEGENDARY,
    startingBid: 1000,
    currentBid: 2500,
    currentBidder: {
      id: 'user1',
      username: 'DragonHunter',
      avatar: undefined,
    },
    minBidIncrement: 100,
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.ACTIVE,
    guildId: 'guild1',
    sellerId: 'seller1',
    seller: {
      id: 'seller1',
      username: 'GuildMaster',
      avatar: undefined,
    },
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
    seller: {
      id: 'seller2',
      username: 'Enchanter',
      avatar: undefined,
    },
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
    currentBidder: {
      id: 'user3',
      username: 'Healer',
      avatar: undefined,
    },
    minBidIncrement: 25,
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    status: AuctionStatus.UPCOMING,
    guildId: 'guild1',
    sellerId: 'seller3',
    seller: {
      id: 'seller3',
      username: 'ScrollMaster',
      avatar: undefined,
    },
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
    currentBidder: {
      id: 'user4',
      username: 'Blacksmith',
      avatar: undefined,
    },
    minBidIncrement: 25,
    startTime: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: AuctionStatus.ENDED,
    guildId: 'guild1',
    sellerId: 'seller4',
    seller: {
      id: 'seller4',
      username: 'Miner',
      avatar: undefined,
    },
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
];

interface AuctionPageProps {
  userBalance?: number;
}

const AuctionPage = ({ userBalance = 5000 }: AuctionPageProps) => {
  const t = useTranslations('auctionPage');
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(mockAuctionItems);
  const [filteredItems, setFilteredItems] = useState<AuctionItem[]>(mockAuctionItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const categoryOptions = [
    { key: 'all', label: t('allCategories') },
    ...Object.values(ItemCategory).map(category => ({
      key: category,
      label: category.replace('_', ' ').toUpperCase(),
    })),
  ];

  const rarityOptions = [
    { key: 'all', label: t('allRarities') },
    ...Object.values(ItemRarity).map(rarity => ({
      key: rarity,
      label: rarity.toUpperCase(),
    })),
  ];

  useEffect(() => {
    let filtered = auctionItems;

    if (activeTab !== 'all') {
      filtered = filtered.filter(item => item.status === activeTab);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (selectedRarity !== 'all') {
      filtered = filtered.filter(item => item.rarity === selectedRarity);
    }

    setFilteredItems(filtered);
  }, [auctionItems, searchTerm, selectedCategory, selectedRarity, activeTab]);

  const handlePlaceBid = async (itemId: string, amount: number) => {
    setIsLoading(true);

    setTimeout(() => {
      setAuctionItems(prevItems =>
        prevItems.map(item => {
          if (item.id === itemId) {
            const newBid = {
              id: `bid-${Date.now()}`,
              auctionItemId: itemId,
              bidderId: 'current-user',
              bidder: { id: 'current-user', username: 'You' },
              amount,
              timestamp: new Date().toISOString(),
              isWinning: true,
            };

            const updatedBidHistory = item.bidHistory.map(bid => ({
              ...bid,
              isWinning: false,
            }));

            return {
              ...item,
              currentBid: amount,
              currentBidder: { id: 'current-user', username: 'You' },
              bidHistory: [...updatedBidHistory, newBid],
              updatedAt: new Date().toISOString(),
            };
          }
          return item;
        })
      );
      setIsLoading(false);
    }, 1000);
  };

  const getStatusCounts = () => ({
    all: auctionItems.length,
    active: auctionItems.filter(item => item.status === AuctionStatus.ACTIVE).length,
    upcoming: auctionItems.filter(item => item.status === AuctionStatus.UPCOMING).length,
    ended: auctionItems.filter(item => item.status === AuctionStatus.ENDED).length,
  });

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-5">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <Card className="border border-divider shadow-none bg-content1">
          <CardBody className="py-3">
            <div className="flex flex-col lg:flex-row gap-3">
              <Input
                placeholder={t('searchItems')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                startContent={
                  <Icon icon="solar:magnifer-linear" width={16} className="text-default-400" />
                }
                className="lg:flex-1"
                variant="bordered"
              />

              <Select
                placeholder={t('allCategories')}
                selectedKeys={selectedCategory ? [selectedCategory] : []}
                onSelectionChange={keys => {
                  const selected = Array.from(keys)[0] as string;
                  setSelectedCategory(selected || 'all');
                }}
                className="lg:max-w-xs"
                variant="bordered"
              >
                {categoryOptions.map(option => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>

              <Select
                placeholder={t('allRarities')}
                selectedKeys={selectedRarity ? [selectedRarity] : []}
                onSelectionChange={keys => {
                  const selected = Array.from(keys)[0] as string;
                  setSelectedRarity(selected || 'all');
                }}
                className="lg:max-w-xs"
                variant="bordered"
              >
                {rarityOptions.map(option => (
                  <SelectItem key={option.key}>{option.label}</SelectItem>
                ))}
              </Select>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={key => setActiveTab(key as string)}
        size="md"
      >
        <Tab
          key="all"
          title={
            <div className="flex items-center gap-2">
              <span>{t('all')}</span>
              <Chip size="sm" variant="flat">
                {statusCounts.all}
              </Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.ACTIVE}
          title={
            <div className="flex items-center gap-2">
              <span>{t('active')}</span>
              <Chip size="sm" color="success" variant="flat">
                {statusCounts.active}
              </Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.UPCOMING}
          title={
            <div className="flex items-center gap-2">
              <span>{t('upcoming')}</span>
              <Chip size="sm" color="warning" variant="flat">
                {statusCounts.upcoming}
              </Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.ENDED}
          title={
            <div className="flex items-center gap-2">
              <span>{t('ended')}</span>
              <Chip size="sm" variant="flat">
                {statusCounts.ended}
              </Chip>
            </div>
          }
        />
      </Tabs>

      {/* Items Grid */}
      {filteredItems.length === 0 ? (
        <Card className="border border-divider shadow-none">
          <CardBody className="text-center py-12">
            <Icon
              icon="solar:clock-circle-linear"
              width={40}
              className="mx-auto mb-3 text-default-300"
            />
            <h3 className="text-base font-medium mb-1 text-foreground">{t('noAuctions')}</h3>
            <p className="text-sm text-default-500">{t('noAuctionsHint')}</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <AuctionItemCard
              key={item.id}
              item={item}
              onPlaceBid={handlePlaceBid}
              isLoading={isLoading}
              userBalance={userBalance}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AuctionPage;
