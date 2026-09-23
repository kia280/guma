'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, Select, Chip, Tabs, TextField, Label, InputGroup, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import AuctionItemCard from '@/components/AuctionItemCard';
import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';

interface AuctionPageProps {
  userBalance?: number;
}

const AuctionPage = ({ userBalance = 5000 }: AuctionPageProps) => {
  const t = useTranslations('auctionPage');
  const guildId = useCurrentGuildId();

  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetchAuctions = () => {
    apiClient.listAuctions(guildId).then(setAuctionItems).catch(() => {});
  };
  useEffect(() => {
    refetchAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const [filteredItems, setFilteredItems] = useState<AuctionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');

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
    try {
      await apiClient.placeBid(guildId, itemId, amount);
      refetchAuctions();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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
