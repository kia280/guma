'use client';

import React from 'react';
import { Tabs, Tab, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import LotteryCard from '@/components/LotteryCard';

const mockLotteries = [
  {
    id: 'l1',
    title: 'Grand Guild Lottery',
    prizePool: 10000,
    ticketPrice: 50,
    drawDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 142,
    maxTickets: 200,
    status: 'active' as const,
    winners: undefined,
  },
  {
    id: 'l2',
    title: 'Weekly Mini Draw',
    prizePool: 1500,
    ticketPrice: 10,
    drawDate: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 88,
    maxTickets: 100,
    status: 'active' as const,
    winners: undefined,
  },
  {
    id: 'l3',
    title: 'Legendary Item Raffle',
    prizePool: 5000,
    ticketPrice: 100,
    drawDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 15,
    maxTickets: 50,
    status: 'upcoming' as const,
    winners: undefined,
  },
  {
    id: 'l4',
    title: 'Monthly Mega Draw',
    prizePool: 25000,
    ticketPrice: 200,
    drawDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    ticketsSold: 125,
    maxTickets: 125,
    status: 'ended' as const,
    winners: [
      { id: 'w1', username: 'DragonHunter', prize: '$12,500 (1st place)' },
      { id: 'w2', username: 'Healer', prize: '$7,500 (2nd place)' },
      { id: 'w3', username: 'Warrior123', prize: '$5,000 (3rd place)' },
    ],
  },
];

export default function LotteryPage() {
  const t = useTranslations('lotteryPage');
  const [activeTab, setActiveTab] = React.useState('all');

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
                {counts.all}
              </Chip>
            </div>
          }
        />
        <Tab
          key="active"
          title={
            <div className="flex items-center gap-2">
              <span>{t('active')}</span>
              <Chip size="sm" color="success" variant="flat">
                {counts.active}
              </Chip>
            </div>
          }
        />
        <Tab
          key="upcoming"
          title={
            <div className="flex items-center gap-2">
              <span>{t('upcoming')}</span>
              <Chip size="sm" color="warning" variant="flat">
                {counts.upcoming}
              </Chip>
            </div>
          }
        />
        <Tab
          key="ended"
          title={
            <div className="flex items-center gap-2">
              <span>{t('ended')}</span>
              <Chip size="sm" variant="flat">
                {counts.ended}
              </Chip>
            </div>
          }
        />
      </Tabs>

      {/* Lottery Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-default-400">
          <Icon icon="solar:ticket-linear" width={40} className="mx-auto mb-3 text-default-300" />
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
    </div>
  );
}
