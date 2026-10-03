'use client';

import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React, { useRef, useState, type TouchEvent } from 'react';
import { BalanceTrendChart } from '@/components/BalanceTrendChart';
import type { useBalanceTrend } from '@/hooks/useBalanceTrend';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { GuildStats } from '@/types/dashboard';
import type { UserStats } from '@/types/user';
import { StatCard } from './StatCard';

const SLIDES = ['personal', 'guild'] as const;
type Slide = (typeof SLIDES)[number];
const SWIPE_THRESHOLD_PX = 40;

interface OverviewCarouselProps {
  guildStats: GuildStats;
  personalStats: UserStats;
  balanceTrend: ReturnType<typeof useBalanceTrend>;
}

export function OverviewCarousel({ guildStats, personalStats, balanceTrend }: OverviewCarouselProps) {
  const GUILD_STATS = guildStats;
  const PERSONAL_STATS = personalStats;
  const t = useTranslations('dashboard');
  const [active, setActive] = useState<Slide>('personal');
  const idx = SLIDES.indexOf(active);
  const formatGold = useFormatGold();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goTo = (i: number) => setActive(SLIDES[Math.min(Math.max(i, 0), SLIDES.length - 1)]);

  const slideProps = (slide: Slide) => ({
    inert: slide !== active,
    className: 'flex min-w-full flex-col gap-3 p-1',
  });

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
      <div className="-m-1 overflow-hidden">
        {/* Slide track */}
        <div
          className="flex items-stretch transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${idx * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* ── Slide 0: Personal Overview ── */}
          <div {...slideProps('personal')}>
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
                label={t('attendance')}
                value={PERSONAL_STATS.attendanceThisMonth}
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
            <Card className="border border-transparent shadow-edge bg-surface">
              <Card.Content>
                <p className="type-caption text-hint mb-2">{t('balanceLast30')}</p>
                <BalanceTrendChart
                  points={balanceTrend.points}
                  status={balanceTrend.status}
                  onRetry={balanceTrend.retry}
                  height={240}
                  emptySize="xs"
                />
              </Card.Content>
            </Card>
          </div>

          {/* ── Slide 1: Guild Overview ── */}
          <div {...slideProps('guild')}>
            <div className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-linear" width={18} className="text-hint" />
              <h2 className="type-heading text-foreground">{t('guildOverview')}</h2>
            </div>

            {/* Stat row */}
            <div className="grid flex-1 auto-rows-fr grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
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
                label={t('attendancePerWeek')}
                value={GUILD_STATS.attendanceThisWeek}
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
                label={t('openRaffles')}
                value={GUILD_STATS.openRaffles}
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
          className="max-sm:size-11"
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
              className="group flex h-11 min-w-11 items-center sm:h-8 sm:min-w-8 justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-focus"
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
          className="max-sm:size-11"
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
