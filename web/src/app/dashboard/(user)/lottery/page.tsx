'use client';

import { Button, Tabs, Chip, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton } from '@/components/AsyncContent';
import { CreateLotteryModal } from '@/components/CreateLotteryModal';
import LotteryCard from '@/components/LotteryCard';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import type { Lottery } from '@/types/lottery';

export default function LotteryPage() {
  const t = useTranslations('lotteryPage');
  const guildId = useCurrentGuildId();
  const [activeTab, setActiveTab] = React.useState('all');
  const [mockLotteries, setMockLotteries] = React.useState<Lottery[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const watchedSince = React.useRef(Date.now());
  const autoOpened = React.useRef(new Set<string>());

  const createModalState = useOverlayState();
  const [reloadKey, setReloadKey] = React.useState(0);
  const lotteriesState = useLoadState();
  const notify = useToast();
  const reload = React.useCallback(() => {
    lotteriesState.reset();
    setReloadKey(key => key + 1);
  }, [lotteriesState.reset]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .listLotteries(guildId)
      .then(d => {
        if (cancelled) return;
        setMockLotteries(d);
        lotteriesState.ready();
      })
      .catch(() => {
        if (cancelled) return;
        lotteriesState.failed();
        notify.loadFailed(reload, 'lotteries');
      });
    return () => { cancelled = true; };
  }, [guildId, pathname, reloadKey, notify, reload, lotteriesState.ready, lotteriesState.failed]);

  useLiveResource(['lottery'], () => setReloadKey(key => key + 1), { guildId });

  React.useEffect(() => {
    if (pathname !== '/dashboard/lottery') return;
    const timer = setInterval(() => {
      const now = Date.now();
      const due = mockLotteries.find(lottery => {
        const drawAt = new Date(lottery.drawDate).getTime();
        return (
          lottery.status !== 'upcoming' &&
          drawAt > watchedSince.current &&
          drawAt <= now &&
          !autoOpened.current.has(lottery.id)
        );
      });
      if (!due) return;
      autoOpened.current.add(due.id);
      router.push(`/dashboard/lottery/${due.id}`);
    }, 1000);
    return () => clearInterval(timer);
  }, [mockLotteries, pathname, router]);

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
      <div className="flex justify-end">
        <Button onPress={createModalState.open}>
          <Icon icon="solar:add-circle-linear" width={16} />
          {t('createLottery')}
        </Button>
      </div>
      <CreateLotteryModal state={createModalState} onCreated={() => setReloadKey(key => key + 1)} />

      {/* Status Tabs */}
      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('statusTabs')}>
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
          <AsyncContent
            state={lotteriesState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
          >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-disabled"
              />
              <p className="type-body">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id="active" className="pt-4">
          <AsyncContent
            state={lotteriesState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
          >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-disabled"
              />
              <p className="type-body">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id="upcoming" className="pt-4">
          <AsyncContent
            state={lotteriesState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
          >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-disabled"
              />
              <p className="type-body">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
        <Tabs.Panel id="ended" className="pt-4">
          <AsyncContent
            state={lotteriesState.state}
            onRetry={reload}
            skeleton={<CardGridSkeleton className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
          >
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-hint">
              <Icon
                icon="solar:ticket-linear"
                width={40}
                className="mx-auto mb-3 text-disabled"
              />
              <p className="type-body">{t('noLotteries')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(lottery => (
                <LotteryCard
                  key={lottery.id}
                  {...lottery}
                />
              ))}
            </div>
          )}
          </AsyncContent>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
