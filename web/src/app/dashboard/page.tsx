'use client';

import { Skeleton } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { AsyncContent } from '@/components/AsyncContent';
import { useCurrentGuildId } from '@/lib/current-guild';
import { AnnouncementsSection } from './_components/AnnouncementsSection';
import { OverviewCarousel } from './_components/OverviewCarousel';
import { UpcomingEventsSection } from './_components/UpcomingEventsSection';
import { useDashboardData } from './_hooks/useDashboardData';

export default function DashboardPage() {
  const nav = useTranslations('dashboardLayout');
  const guildId = useCurrentGuildId();
  const data = useDashboardData(guildId);

  if (data.state !== 'ready') {
    return (
      <AsyncContent
        state={data.state}
        onRetry={data.reload}
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
      <h1 className="sr-only">{nav('dashboard')}</h1>
      {/* Overview Carousel */}
      <OverviewCarousel
        guildStats={data.guildStats}
        personalStats={data.personalStats}
        balanceTrend={data.balanceTrend}
      />

      {/* Bottom two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AnnouncementsSection announcements={data.announcements} />
        <UpcomingEventsSection events={data.incomingEvents} />
      </div>
    </div>
  );
}
