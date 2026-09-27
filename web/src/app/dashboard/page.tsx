'use client';

import { Card, Chip, Modal, Button, Skeleton, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect, useCallback, type TouchEvent } from 'react';
import { AsyncContent, EmptyContent } from '@/components/AsyncContent';
import { BalanceTrendChart } from '@/components/BalanceTrendChart';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { useBalanceTrend } from '@/hooks/useBalanceTrend';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { LIST_ROW_CLASS } from '@/lib/list-row';
import { subscribeLiveEvents, type LiveResource } from '@/lib/live-events';
import { useUserStore } from '@/lib/store';
import type {
  Announcement,
  DashboardData,
  EventKind,
  FeedEvent,
} from '@/types/dashboard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ChipColor = 'danger' | 'warning' | 'success' | 'accent' | 'default';

const KIND_META: Record<
  EventKind,
  {
    icon: string;
    labelKey: string;
    color: ChipColor;
    href: string;
  }
> = {
  auction: { icon: 'solar:sledgehammer-linear', labelKey: 'kindAuction', color: 'warning', href: '/dashboard/auction' },
  checkin: { icon: 'solar:check-circle-linear', labelKey: 'kindCheckin', color: 'success', href: '/dashboard/attendance' },
  lottery: { icon: 'solar:ticket-linear', labelKey: 'kindLottery', color: 'accent', href: '/dashboard/lottery' },
  calendar: { icon: 'solar:calendar-linear', labelKey: 'kindCalendar', color: 'accent', href: '/dashboard/calendar' },
};

const URGENCY_DOT: Record<FeedEvent['urgency'], string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-muted',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconClass,
  iconBg,
  label,
  value,
}: {
  icon: string;
  iconClass: string;
  iconBg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center min-w-0 gap-2.5 sm:gap-3 p-3 rounded-xl border border-divider bg-surface">
      <div className={`${iconBg} p-2 sm:p-2.5 rounded-lg shrink-0`}>
        <Icon icon={icon} width={18} className={iconClass} />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="type-caption text-hint truncate">{label}</p>
        <p className="type-heading sm:type-title tabular-nums text-foreground mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Overview Carousel ────────────────────────────────────────────────────────

const SLIDES = ['personal', 'guild'] as const;
type Slide = (typeof SLIDES)[number];
const SWIPE_THRESHOLD_PX = 40;

interface OverviewCarouselProps {
  guildStats: import('@/types/dashboard').GuildStats;
  personalStats: import('@/types/user').UserStats;
  balanceTrend: ReturnType<typeof useBalanceTrend>;
}

function OverviewCarousel({ guildStats, personalStats, balanceTrend }: OverviewCarouselProps) {
  const GUILD_STATS = guildStats;
  const PERSONAL_STATS = personalStats;
  const t = useTranslations('dashboard');
  const [active, setActive] = useState<Slide>('personal');
  const idx = SLIDES.indexOf(active);
  const formatGold = useFormatGold();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = (i: number) => setActive(SLIDES[Math.min(Math.max(i, 0), SLIDES.length - 1)]);

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    goTo(dx < 0 ? idx + 1 : idx - 1);
  };

  return (
    <section>
      <div className="overflow-hidden">
        {/* Slide track */}
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* ── Slide 0: Personal Overview ── */}
          <div className="min-w-full space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:user-linear" width={18} className="text-hint" />
              <h2 className="type-heading text-foreground">{t('personalOverview')}</h2>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                icon="solar:wallet-linear"
                iconClass="text-accent"
                iconBg="bg-accent/10"
                label={t('balance')}
                value={formatGold(PERSONAL_STATS.balance)}
              />
              <StatCard
                icon="solar:check-circle-linear"
                iconClass="text-success"
                iconBg="bg-success/10"
                label={t('checkIns')}
                value={PERSONAL_STATS.checkinsThisMonth}
              />
              <StatCard
                icon="solar:sledgehammer-linear"
                iconClass="text-warning"
                iconBg="bg-warning/10"
                label={t('activeAuctions')}
                value={PERSONAL_STATS.activeAuctions}
              />
              <StatCard
                icon="solar:star-linear"
                iconClass="text-accent"
                iconBg="bg-accent/10"
                label={t('activityPts')}
                value={PERSONAL_STATS.activityPoints}
              />
            </div>

            {/* Wallet balance chart */}
            <Card className="border border-divider shadow-none bg-surface">
              <Card.Content>
                <p className="type-caption text-hint mb-2">{t('balanceLast30')}</p>
                <BalanceTrendChart
                  points={balanceTrend.points}
                  status={balanceTrend.status}
                  onRetry={balanceTrend.retry}
                  height={240}
                />
              </Card.Content>
            </Card>
          </div>

          {/* ── Slide 1: Guild Overview ── */}
          <div className="min-w-full space-y-3">
            <div className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-linear" width={18} className="text-hint" />
              <h2 className="type-heading text-foreground">{t('guildOverview')}</h2>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                icon="solar:users-group-rounded-linear"
                iconClass="text-accent"
                iconBg="bg-accent/10"
                label={t('members')}
                value={GUILD_STATS.members}
              />
              <StatCard
                icon="solar:calendar-mark-linear"
                iconClass="text-success"
                iconBg="bg-success/10"
                label={t('activeEvents')}
                value={GUILD_STATS.activeEvents}
              />
              <StatCard
                icon="solar:wallet-linear"
                iconClass="text-warning"
                iconBg="bg-warning/10"
                label={t('guildBalance')}
                value={formatGold(GUILD_STATS.balance)}
              />
              <StatCard
                icon="solar:check-square-linear"
                iconClass="text-success"
                iconBg="bg-success/10"
                label={t('checkInsPerWeek')}
                value={GUILD_STATS.checkinsThisWeek}
              />
              <StatCard
                icon="solar:sledgehammer-linear"
                iconClass="text-warning"
                iconBg="bg-warning/10"
                label={t('activeAuctions')}
                value={GUILD_STATS.activeAuctions}
              />
              <StatCard
                icon="solar:ticket-linear"
                iconClass="text-accent"
                iconBg="bg-accent/10"
                label={t('openLotteries')}
                value={GUILD_STATS.openLotteries}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dot navigation */}
      <div className="flex items-center justify-center gap-2 pt-2">
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t('previousSlide')}
          isDisabled={idx === 0}
          onPress={() => goTo(idx - 1)}
        >
          <Icon icon="solar:alt-arrow-left-linear" width={16} />
        </Button>
        <div role="group" aria-label={t('overview')} className="flex items-center">
          {SLIDES.map((slide, i) => (
            <button
              key={slide}
              type="button"
              onClick={() => setActive(slide)}
              aria-label={slide === 'personal' ? t('personalOverview') : t('guildOverview')}
              aria-current={i === idx ? 'true' : undefined}
              className="group flex h-8 min-w-8 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span
                className={`h-2.5 rounded-full transition-all duration-200 ${
                  i === idx ? 'w-6 bg-accent' : 'w-2.5 bg-muted/30 group-hover:bg-muted/50'
                }`}
              />
            </button>
          ))}
        </div>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t('nextSlide')}
          isDisabled={idx === SLIDES.length - 1}
          onPress={() => goTo(idx + 1)}
        >
          <Icon icon="solar:alt-arrow-right-linear" width={16} />
        </Button>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LIVE_DASHBOARD_RESOURCES: readonly LiveResource[] = ['bank', 'auction', 'lottery', 'checkin', 'announcement'];
const LIVE_REFETCH_DEBOUNCE_MS = 250;

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const guildId = useCurrentGuildId();
  const [selectedAnn, setSelectedAnn] = useState<Announcement | null>(null);
  const annModalState = useOverlayState({
    onOpenChange: (isOpen) => {
      if (!isOpen) setSelectedAnn(null);
    },
  });

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const balanceTrend = useBalanceTrend(guildId);
  const refetchTrend = balanceTrend.refetch;
  const dashboardState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => {
    dashboardState.reset();
    setReloadKey(key => key + 1);
  }, [dashboardState.reset]);
  const requestSeq = useRef(0);
  const refetchDashboard = useCallback(() => {
    const seq = ++requestSeq.current;
    apiClient
      .getDashboardData(guildId)
      .then(d => {
        if (seq !== requestSeq.current) return;
        setDashboard(d);
        dashboardState.ready();
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        dashboardState.failed();
        notify.loadFailed(reload, 'dashboard');
      });
  }, [guildId, notify, reload, dashboardState.ready, dashboardState.failed]);

  useEffect(() => {
    refetchDashboard();
    return () => { requestSeq.current++; };
  }, [refetchDashboard, reloadKey]);

  useLiveResource(LIVE_DASHBOARD_RESOURCES, refetchDashboard, { guildId });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeLiveEvents(event => {
      if (event.kind !== 'wallet' || event.guildId !== guildId) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        refetchDashboard();
        refetchTrend();
      }, LIVE_REFETCH_DEBOUNCE_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [guildId, refetchDashboard, refetchTrend]);

  const liveBalance = useUserStore(s =>
    s.user && s.user.currentGuildId === guildId ? s.user.balance : undefined,
  );

  const guildStats = dashboard?.guildStats ?? {
    members: 0, activeEvents: 0, balance: 0, checkinsThisWeek: 0, activeAuctions: 0, openLotteries: 0,
  };
  const fetchedPersonalStats = dashboard?.personalStats ?? {
    balance: 0, checkinsThisMonth: 0, activeAuctions: 0, activityPoints: 0,
  };
  const personalStats = liveBalance === undefined
    ? fetchedPersonalStats
    : { ...fetchedPersonalStats, balance: liveBalance };
  const announcements = dashboard?.announcements ?? [];
  const incomingEvents = dashboard?.incomingEvents ?? [];

  if (dashboardState.state !== 'ready') {
    return (
      <AsyncContent
        state={dashboardState.state}
        onRetry={reload}
        skeleton={
          <div className="space-y-5" aria-busy="true">
            <Skeleton className="h-80 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </div>
        }
      >
        {null}
      </AsyncContent>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overview Carousel */}
      <OverviewCarousel
        guildStats={guildStats}
        personalStats={personalStats}
        balanceTrend={balanceTrend}
      />

      {/* Bottom two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Announcements ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:volume-loud-linear" width={18} className="text-hint" />
            <h2 className="type-heading text-foreground">{t('news')}</h2>
          </div>
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Content className="p-1.5">
              {announcements.length === 0 ? (
                <EmptyContent icon="solar:volume-loud-linear" title={t('noAnnouncements')} />
              ) : (
              <ul className="flex flex-col gap-0.5">
                {announcements.map(ann => (
                  <li key={ann.id}>
                    <button
                      type="button"
                      className={`w-full text-left ${LIST_ROW_CLASS}`}
                      onClick={() => { setSelectedAnn(ann); annModalState.open(); }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {ann.pinned && (
                            <Icon
                              icon="solar:pin-linear"
                              width={14}
                              className="text-danger shrink-0 mt-0.5"
                            />
                          )}
                          <p className="type-body text-foreground truncate">{ann.title}</p>
                        </div>
                        <span className="type-caption text-hint shrink-0">{ann.date}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              )}
            </Card.Content>
          </Card>
        </section>

        {/* ── Upcoming Events ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Icon icon="solar:bell-linear" width={18} className="text-hint" />
            <h2 className="type-heading text-foreground">{t('upcomingEvents')}</h2>
          </div>
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Content className="p-1.5">
              {incomingEvents.length === 0 ? (
                <EmptyContent icon="solar:bell-linear" title={t('noUpcomingEvents')} />
              ) : (
              <ul className="flex flex-col gap-0.5">
                {incomingEvents.map(event => {
                  const meta = KIND_META[event.kind];
                  return (
                    <li key={event.id}>
                      <Link href={meta.href} className={`flex items-center gap-3 ${LIST_ROW_CLASS}`}>
                        {/* Urgency dot */}
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${URGENCY_DOT[event.urgency]}`}
                        />

                        {/* Kind icon */}
                        <div className="p-1.5 rounded-md bg-default shrink-0">
                          <Icon icon={meta.icon} width={14} className="text-subtle" />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="type-body font-medium text-foreground truncate">
                            {event.title}
                          </p>
                          <p className="type-caption text-hint truncate">{event.subtitle}</p>
                        </div>

                        {/* Meta */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Chip size="sm" variant="secondary" color={meta.color}>
                            {t(meta.labelKey as any)}
                          </Chip>
                          <span className="type-caption text-hint">{event.timeLabel}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              )}
            </Card.Content>
          </Card>
        </section>
      </div>

      {/* ── Announcement modal ── */}
      <Modal state={annModalState}>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog className="bg-surface border border-divider max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-start gap-3 border-b border-divider pb-3 pr-10">
              {selectedAnn?.pinned && (
                <Icon icon="solar:pin-bold" width={16} className="text-danger shrink-0 mt-0.5" />
              )}
              <Modal.Heading>
                {selectedAnn?.title}
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-3">
              <p className="type-body text-subtle">{selectedAnn?.date}</p>
              <DiscordMarkdown content={selectedAnn?.content ?? ''} className="type-prose text-foreground" />
            </Modal.Body>

            <Modal.Footer className="border-t border-divider pt-3">
              <Button slot="close" variant="secondary" size="sm">
                {t('close')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
