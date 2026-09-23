'use client';

import React from 'react';
import { Tabs, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import LotteryCard from '@/components/LotteryCard';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import type { Lottery } from '@/types/lottery';

export default function LotteryPage() {
  const t = useTranslations('lotteryPage');
  const guildId = useCurrentGuildId();
  const [activeTab, setActiveTab] = React.useState('all');
  const [mockLotteries, setMockLotteries] = React.useState<Lottery[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.listLotteries(guildId).then(d => { if (!cancelled) setMockLotteries(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [guildId]);

  const filtered =
    activeTab === 'all' ? mockLotteries : mockLotteries.filter(l => l.status === activeTab);

  const counts = {
    all: mockLotteries.length,
    active: mockLotteries.filter(l => l.status === 'active').length,
    upcoming: mockLotteries.filter(l => l.status === 'upcoming').length,
    ended: mockLotteries.filter(l => l.status === 'ended').length,
  };

  return (
    <div className="space-y-5">
      {/* Status Tabs */}
      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Lottery status">
            <Tabs.Tab id="all">
              <div className="flex items-center gap-2">
                <span>{t('all')}</span>
                <Chip size="sm" variant="secondary">
                  {counts.all}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="active">
              <div className="flex items-center gap-2">
                <span>{t('active')}</span>
                <Chip size="sm" color="success" variant="secondary">
                  {counts.active}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="upcoming">
              <div className="flex items-center gap-2">
                <span>{t('upcoming')}</span>
                <Chip size="sm" color="warning" variant="secondary">
                  {counts.upcoming}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="ended">
              <div className="flex items-center gap-2">
                <span>{t('ended')}</span>
                <Chip size="sm" variant="secondary">
                  {counts.ended}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="all" className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-foreground/40">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-foreground/30"
              />
              <p className="text-sm">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                  onBuyTicket={id => console.log('Buy ticket for lottery:', id)}
                  onViewWinners={id => console.log('View winners for lottery:', id)}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="active" className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-foreground/40">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-foreground/30"
              />
              <p className="text-sm">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                  onBuyTicket={id => console.log('Buy ticket for lottery:', id)}
                  onViewWinners={id => console.log('View winners for lottery:', id)}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="upcoming" className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-foreground/40">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-foreground/30"
              />
              <p className="text-sm">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                  onBuyTicket={id => console.log('Buy ticket for lottery:', id)}
                  onViewWinners={id => console.log('View winners for lottery:', id)}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>
        <Tabs.Panel id="ended" className="pt-4">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-foreground/40">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-foreground/30"
              />
              <p className="text-sm">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                  onBuyTicket={id => console.log('Buy ticket for lottery:', id)}
                  onViewWinners={id => console.log('View winners for lottery:', id)}
                />
              ))}
            </div>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
