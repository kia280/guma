'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, Select, Chip, Tabs, TextField, Label, InputGroup, ListBox } from '@heroui/react';
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
      <div className="flex flex-col lg:flex-row gap-3">
        <TextField className="lg:flex-1">
          <Label className="sr-only">{t('searchItems')}</Label>
          <InputGroup>
            <InputGroup.Prefix>
              <Icon icon="solar:magnifer-linear" width={16} className="text-foreground/40" />
            </InputGroup.Prefix>
            <InputGroup.Input
              placeholder={t('searchItems')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </TextField>

              <Select
                className="lg:max-w-xs"
                value={selectedCategory}
                onChange={value => setSelectedCategory(String(value) || 'all')}
              >
                <Label className="sr-only">{t('allCategories')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {categoryOptions.map(option => (
                      <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <Select
                className="lg:max-w-xs"
                value={selectedRarity}
                onChange={value => setSelectedRarity(String(value) || 'all')}
              >
                <Label className="sr-only">{t('allRarities')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {rarityOptions.map(option => (
                      <ListBox.Item key={option.key} id={option.key} textValue={option.label}>
                        {option.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
        </Select>
      </div>

      {/* Status Tabs */}
      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Auction status">
            <Tabs.Tab id="all">
              <div className="flex items-center gap-2">
                <span>{t('all')}</span>
                <Chip size="sm" variant="secondary">
                  {statusCounts.all}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id={AuctionStatus.ACTIVE}>
              <div className="flex items-center gap-2">
                <span>{t('active')}</span>
                <Chip size="sm" color="success" variant="secondary">
                  {statusCounts.active}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id={AuctionStatus.UPCOMING}>
              <div className="flex items-center gap-2">
                <span>{t('upcoming')}</span>
                <Chip size="sm" color="warning" variant="secondary">
                  {statusCounts.upcoming}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id={AuctionStatus.ENDED}>
              <div className="flex items-center gap-2">
                <span>{t('ended')}</span>
                <Chip size="sm" variant="secondary">
                  {statusCounts.ended}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="all" className="pt-4">
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-foreground/30"
                />
                <h3 className="text-base font-medium mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="text-sm text-foreground/50">{t('noAuctionsHint')}</p>
              </Card.Content>
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
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.ACTIVE} className="pt-4">
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-foreground/30"
                />
                <h3 className="text-base font-medium mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="text-sm text-foreground/50">{t('noAuctionsHint')}</p>
              </Card.Content>
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
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.UPCOMING} className="pt-4">
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-foreground/30"
                />
                <h3 className="text-base font-medium mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="text-sm text-foreground/50">{t('noAuctionsHint')}</p>
              </Card.Content>
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
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.ENDED} className="pt-4">
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-foreground/30"
                />
                <h3 className="text-base font-medium mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="text-sm text-foreground/50">{t('noAuctionsHint')}</p>
              </Card.Content>
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
        </Tabs.Panel>
      </Tabs>

    </div>
  );
};

export default AuctionPage;
