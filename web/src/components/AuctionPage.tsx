'use client';

import { Button, Card, Select, Chip, Tabs, TextField, Label, InputGroup, ListBox, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { AsyncContent, CardGridSkeleton } from '@/components/AsyncContent';
import AuctionItemCard from '@/components/AuctionItemCard';
import { CreateAuctionModal } from '@/components/CreateAuctionModal';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { AuctionItem, AuctionStatus } from '@/types/auction';
import { ItemCategory, ItemRarity } from '@/types/item';

const AuctionPage = () => {
  const t = useTranslations('auctionPage');
  const labels = useTranslations('createAuctionModal');
  const guildId = useCurrentGuildId();
  const { balance: userBalance, refresh: refreshBalance } = useWalletBalance();
  const createModalState = useOverlayState();

  const [auctionItems, setAuctionItems] = useState<AuctionItem[]>([]);
  const [pendingBidIds, setPendingBidIds] = useState<ReadonlySet<string>>(new Set());
  const auctionsState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    auctionsState.reset();
    setReloadKey(key => key + 1);
  };

  const latestRequest = useRef(0);
  const refetchAuctions = () => {
    const request = ++latestRequest.current;
    apiClient
      .listAuctions(guildId)
      .then(items => {
        if (request !== latestRequest.current) return;
        setAuctionItems(items);
        auctionsState.ready();
      })
      .catch(() => {
        if (request !== latestRequest.current) return;
        auctionsState.failed();
        notify.loadFailed(reload, 'auctions');
      });
  };
  useEffect(() => {
    refetchAuctions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, reloadKey]);

  useLiveResource(['auction'], refetchAuctions, { guildId });

  const [filteredItems, setFilteredItems] = useState<AuctionItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRarity, setSelectedRarity] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('all');

  const categoryOptions = [
    { key: 'all', label: t('allCategories') },
    ...Object.values(ItemCategory).map(category => ({
      key: category,
      label: labels(`categories.${category}`),
    })),
  ];

  const rarityOptions = [
    { key: 'all', label: t('allRarities') },
    ...Object.values(ItemRarity).map(rarity => ({
      key: rarity,
      label: labels(`rarities.${rarity}`),
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
    setPendingBidIds(current => new Set(current).add(itemId));
    try {
      await apiClient.placeBid(guildId, itemId, amount);
      refetchAuctions();
      refreshBalance();
      notify.success(t('bidSuccess'));
      return true;
    } catch {
      notify.error(t('bidFailed'));
      return false;
    } finally {
      setPendingBidIds(current => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
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
      <div className="flex justify-end">
        <Button onPress={createModalState.open}>
          <Icon icon="solar:add-circle-linear" width={16} />
          {t('createAuction')}
        </Button>
      </div>
      <CreateAuctionModal state={createModalState} onCreated={refetchAuctions} />

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <TextField className="lg:flex-1">
          <Label className="sr-only">{t('searchItems')}</Label>
          <InputGroup>
            <InputGroup.Prefix>
              <Icon icon="solar:magnifer-linear" width={16} className="text-hint" />
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
          <Tabs.List aria-label={t('statusTabs')}>
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
          <AsyncContent
            state={auctionsState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" cardClassName="h-64 rounded-xl" />}
          >
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-disabled"
                />
                <h3 className="type-subheading mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="type-body text-subtle">{t('noAuctionsHint')}</p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  onPlaceBid={handlePlaceBid}
                  isLoading={pendingBidIds.has(item.id)}
                  userBalance={userBalance}
                  
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.ACTIVE} className="pt-4">
          <AsyncContent
            state={auctionsState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" cardClassName="h-64 rounded-xl" />}
          >
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-disabled"
                />
                <h3 className="type-subheading mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="type-body text-subtle">{t('noAuctionsHint')}</p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  onPlaceBid={handlePlaceBid}
                  isLoading={pendingBidIds.has(item.id)}
                  userBalance={userBalance}
                  
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.UPCOMING} className="pt-4">
          <AsyncContent
            state={auctionsState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" cardClassName="h-64 rounded-xl" />}
          >
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-disabled"
                />
                <h3 className="type-subheading mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="type-body text-subtle">{t('noAuctionsHint')}</p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  onPlaceBid={handlePlaceBid}
                  isLoading={pendingBidIds.has(item.id)}
                  userBalance={userBalance}
                  
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id={AuctionStatus.ENDED} className="pt-4">
          <AsyncContent
            state={auctionsState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" cardClassName="h-64 rounded-xl" />}
          >
          {filteredItems.length === 0 ? (
            <Card className="border border-divider shadow-none">
              <Card.Content className="text-center py-12">
                <Icon
                  icon="solar:clock-circle-linear"
                  width={40}
                  className="mx-auto mb-3 text-disabled"
                />
                <h3 className="type-subheading mb-1 text-foreground">{t('noAuctions')}</h3>
                <p className="type-body text-subtle">{t('noAuctionsHint')}</p>
              </Card.Content>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <AuctionItemCard
                  key={item.id}
                  item={item}
                  onPlaceBid={handlePlaceBid}
                  isLoading={pendingBidIds.has(item.id)}
                  userBalance={userBalance}
                  
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
      </Tabs>

    </div>
  );
};

export default AuctionPage;
