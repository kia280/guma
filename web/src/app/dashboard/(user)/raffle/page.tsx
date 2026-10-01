'use client';

import { Button, Tabs, Chip, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton, EmptyContent } from '@/components/AsyncContent';
import { CreateRaffleModal } from '@/components/CreateRaffleModal';
import RaffleCard from '@/components/RaffleCard';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { useGuildPermissions } from '@/lib/permissions';
import { raffleStatusColor } from '@/lib/status-colors';
import type { Raffle, RaffleStatus } from '@/types/raffle';

type RaffleTab = 'all' | RaffleStatus;

const RAFFLE_TABS: readonly RaffleTab[] = ['all', 'active', 'upcoming', 'ended', 'cancelled'];

export default function RafflePage() {
  const t = useTranslations('rafflePage');
  const nav = useTranslations('dashboardLayout');
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const [activeTab, setActiveTab] = React.useState('all');
  const [mockRaffles, setMockRaffles] = React.useState<Raffle[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const [watchedSince] = React.useState(() => Date.now());
  const announcedDraws = React.useRef(new Set<string>());

  const createModalState = useOverlayState();
  const [reloadKey, setReloadKey] = React.useState(0);
  const rafflesState = useLoadState();
  const notify = useToast();
  const reload = React.useCallback(() => {
    rafflesState.reset();
    setReloadKey(key => key + 1);
  }, [rafflesState.reset]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .listRaffles(guildId)
      .then(d => {
        if (cancelled) return;
        setMockRaffles(d);
        rafflesState.ready();
      })
      .catch(() => {
        if (cancelled) return;
        rafflesState.failed();
        notify.loadFailed(reload, 'raffles');
      });
    return () => { cancelled = true; };
  }, [guildId, pathname, reloadKey, notify, reload, rafflesState.ready, rafflesState.failed]);

  useLiveResource(['raffle'], () => setReloadKey(key => key + 1), { guildId });

  React.useEffect(() => {
    if (pathname !== '/dashboard/raffle') return;
    const timer = setInterval(() => {
      const now = Date.now();
      const due = mockRaffles.find(raffle => {
        const drawAt = new Date(raffle.drawDate).getTime();
        return (
          raffle.status !== 'upcoming' &&
          raffle.status !== 'cancelled' &&
          drawAt > watchedSince &&
          drawAt <= now &&
          !announcedDraws.current.has(raffle.id)
        );
      });
      if (!due) return;
      announcedDraws.current.add(due.id);
      notify.info(t('drawStarted', { title: due.title }), {
        action: { label: t('watchDraw'), onPress: () => router.push(`/dashboard/raffle/${due.id}`) },
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [mockRaffles, pathname, router, notify, t, watchedSince]);

  const filtered =
    activeTab === 'all' ? mockRaffles : mockRaffles.filter(l => l.status === activeTab);

  const counts: Record<RaffleTab, number> = {
    all: mockRaffles.length,
    active: mockRaffles.filter(l => l.status === 'active').length,
    upcoming: mockRaffles.filter(l => l.status === 'upcoming').length,
    ended: mockRaffles.filter(l => l.status === 'ended').length,
    cancelled: mockRaffles.filter(l => l.status === 'cancelled').length,
  };

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{nav('raffle')}</h1>
      {can('createRaffle') && (
        <CreateRaffleModal state={createModalState} onCreated={() => setReloadKey(key => key + 1)} />
      )}

      {/* Status Tabs */}
      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <div className="flex items-center gap-3">
          <Tabs.ListContainer className="min-w-0 flex-1">
            <Tabs.List aria-label={t('statusTabs')}>
              {RAFFLE_TABS.map(tab => (
                <Tabs.Tab key={tab} id={tab} className="max-sm:h-9">
                  <div className="flex items-center gap-2">
                    <span>{t(tab)}</span>
                    <Chip size="sm" color={tab === 'all' ? undefined : raffleStatusColor[tab]} variant="secondary">
                      {counts[tab]}
                    </Chip>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {can('createRaffle') && (
            <Button className="shrink-0 md:h-10 max-sm:size-11 max-sm:px-0" aria-label={t('createRaffle')} onPress={createModalState.open}>
              <Icon icon="solar:add-circle-linear" width={16} className="max-sm:hidden" />
              <Icon icon="solar:add-linear" width={20} className="sm:hidden" />
              <span className="max-sm:hidden">{t('createRaffle')}</span>
            </Button>
          )}
        </div>
        {RAFFLE_TABS.map(tab => (
          <Tabs.Panel key={tab} id={tab} className="pt-4">
            <AsyncContent
              state={rafflesState.state}
              onRetry={reload}
              skeleton={<CardGridSkeleton className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" />}
            >
              {filtered.length === 0 ? (
                <EmptyContent icon="solar:ticket-linear" title={t('noRaffles')} />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filtered.map(raffle => (
                    <RaffleCard key={raffle.id} {...raffle} />
                  ))}
                </div>
              )}
            </AsyncContent>
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
}
