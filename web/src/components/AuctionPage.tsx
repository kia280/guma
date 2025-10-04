'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Input,
  Button,
  Tabs,
  Tab,
  Chip,
  Spinner,
  useDisclosure,
} from '@heroui/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ClockIcon,
  CurrencyDollarIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import AuctionItemCard from '@/components/AuctionItemCard';
import CreateAuctionModal from '@/components/CreateAuctionModal';
import { AuctionItem, ItemCategory, ItemRarity, AuctionStatus, CreateAuctionRequest } from '@/types/auction';

// Mock data for demonstration
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
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(), // 6 hours from now
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
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
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
    endTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // ended 30 minutes ago
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
  guildId?: string;
}

const AuctionPage = ({ userBalance = 5000, guildId = 'guild1' }: AuctionPageProps) => {
  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>(mockAuctionItems);
  const [filteredItems, setFilteredItems] = useState<AuctionItem[]>(mockAuctionItems);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  
  const { isOpen: isCreateModalOpen, onOpen: onCreateModalOpen, onOpenChange: onCreateModalOpenChange } = useDisclosure();

  const categoryOptions = [
    { key: 'all', label: 'All Categories' },
    ...Object.values(ItemCategory).map(category => ({
      key: category,
      label: category.replace('_', ' ').toUpperCase()
    }))
  ];

  const rarityOptions = [
    { key: 'all', label: 'All Rarities' },
    ...Object.values(ItemRarity).map(rarity => ({
      key: rarity,
      label: rarity.toUpperCase()
    }))
  ];

  // Filter items based on search and filters
  useEffect(() => {
    let filtered = auctionItems;

    // Filter by tab (status)
    if (activeTab !== 'all') {
      filtered = filtered.filter(item => item.status === activeTab);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by rarity
    if (selectedRarity !== 'all') {
      filtered = filtered.filter(item => item.rarity === selectedRarity);
    }

    setFilteredItems(filtered);
  }, [auctionItems, searchTerm, selectedCategory, selectedRarity, activeTab]);

  const handleCreateAuction = async (auctionData: CreateAuctionRequest) => {
    setIsLoading(true);
    
    // Simulate API call to create auction
    setTimeout(() => {
      const newAuction: AuctionItem = {
        id: `auction-${Date.now()}`,
        name: auctionData.name,
        description: auctionData.description,
        category: auctionData.category,
        rarity: auctionData.rarity,
        startingBid: auctionData.startingBid,
        currentBid: auctionData.startingBid,
        minBidIncrement: auctionData.minBidIncrement,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + auctionData.duration * 60 * 60 * 1000).toISOString(),
        status: AuctionStatus.ACTIVE,
        guildId: auctionData.guildId,
        sellerId: 'current-user',
        seller: {
          id: 'current-user',
          username: 'You',
          avatar: undefined,
        },
        bidHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAuctionItems(prevItems => [newAuction, ...prevItems]);
      setIsLoading(false);
    }, 1000);
  };

  const handlePlaceBid = async (itemId: string, amount: number) => {
    setIsLoading(true);
    
    // Simulate API call
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

            // Update existing bids to not be winning
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

  const getStatusCounts = () => {
    const counts = {
      all: auctionItems.length,
      active: auctionItems.filter(item => item.status === AuctionStatus.ACTIVE).length,
      upcoming: auctionItems.filter(item => item.status === AuctionStatus.UPCOMING).length,
      ended: auctionItems.filter(item => item.status === AuctionStatus.ENDED).length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Guild Auction House</h1>
            <p className="text-default-600 mt-1">
              Bid on rare items and resources from guild members
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              color="primary"
              variant="solid"
              startContent={<PlusIcon className="w-4 h-4" />}
              onPress={onCreateModalOpen}
            >
              Create Auction
            </Button>
            <Card className="p-3">
              <div className="flex items-center gap-2">
                <CurrencyDollarIcon className="w-5 h-5 text-warning" />
                <div>
                  <div className="text-tiny text-default-500">Your Balance</div>
                  <div className="text-lg font-bold text-warning">
                    ${userBalance.toLocaleString()}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardBody>
            <div className="flex flex-col lg:flex-row gap-4">
              <Input
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                startContent={<MagnifyingGlassIcon className="w-4 h-4" />}
                className="lg:flex-1"
              />
              
              <Select
                placeholder="All Categories"
                selectedKeys={selectedCategory ? [selectedCategory] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setSelectedCategory(selected || 'all');
                }}
                className="lg:max-w-xs"
                startContent={<FunnelIcon className="w-4 h-4" />}
              >
                {categoryOptions.map((option) => (
                  <SelectItem key={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>

              <Select
                placeholder="All Rarities"
                selectedKeys={selectedRarity ? [selectedRarity] : []}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setSelectedRarity(selected || 'all');
                }}
                className="lg:max-w-xs"
              >
                {rarityOptions.map((option) => (
                  <SelectItem key={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Status Tabs */}
      <Tabs
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(key as string)}
        size="lg"
        radius="full"
      >
        <Tab
          key="all"
          title={
            <div className="flex items-center gap-2">
              <span>All</span>
              <Chip size="sm" variant="flat">{statusCounts.all}</Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.ACTIVE}
          title={
            <div className="flex items-center gap-2">
              <span>Active</span>
              <Chip size="sm" color="success" variant="flat">{statusCounts.active}</Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.UPCOMING}
          title={
            <div className="flex items-center gap-2">
              <span>Upcoming</span>
              <Chip size="sm" color="warning" variant="flat">{statusCounts.upcoming}</Chip>
            </div>
          }
        />
        <Tab
          key={AuctionStatus.ENDED}
          title={
            <div className="flex items-center gap-2">
              <span>Ended</span>
              <Chip size="sm" color="default" variant="flat">{statusCounts.ended}</Chip>
            </div>
          }
        />
      </Tabs>

      {/* Auction Items Grid */}
      {filteredItems.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <div className="text-default-500">
              <ClockIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No auctions found</h3>
              <p>Try adjusting your search criteria or check back later.</p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
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

      {/* Loading Spinner */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <Card>
            <CardBody className="flex items-center gap-3 py-6">
              <Spinner size="sm" />
              <span>Placing bid...</span>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Create Auction Modal */}
      <CreateAuctionModal
        isOpen={isCreateModalOpen}
        onOpenChange={onCreateModalOpenChange}
        onCreateAuction={handleCreateAuction}
        isLoading={isLoading}
        guildId={guildId}
      />
    </div>
  );
};

export default AuctionPage;
