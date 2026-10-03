'use client';

import { Chip, Tabs } from '@heroui/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AdminInbox } from '@/components/AdminInbox';
import { TemplateSettings } from '@/components/TemplateSettings';
import { legacyInboxHref } from '@/lib/admin-inbox';
import { useCurrentGuildId } from '@/lib/current-guild';
import { adminTabFromParam, adminTabHref } from '@/lib/dashboard-nav';
import { useGuildPermissions } from '@/lib/permissions';
import { AnnouncementsPanel } from './_components/AnnouncementsPanel';
import { GuildSettingsCard } from './_components/GuildSettingsCard';
import { GuildStatsGrid } from './_components/GuildStatsGrid';
import { RecentActivityCard } from './_components/RecentActivityCard';
import { UsersPanel } from './_components/UsersPanel';
import { useAdminData } from './_hooks/useAdminData';
import { useAnnouncementActions } from './_hooks/useAnnouncementActions';
import { useGuildOverview } from './_hooks/useGuildOverview';
import { useGuildProfile } from './_hooks/useGuildProfile';
import { useMemberTable } from './_hooks/useMemberTable';

const TABS = ['inbox', 'users', 'templates', 'guild', 'announcements'] as const;

export default function AdminPage() {
  const t = useTranslations('adminPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTab = adminTabFromParam(searchParams.get('tab'));
  const legacyHref = legacyInboxHref(searchParams);
  React.useEffect(() => {
    if (legacyHref) router.replace(legacyHref, { scroll: false });
  }, [legacyHref, router]);
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const canEditGuild = can('editGuild');
  const canManageAssets = can('manageMemberAssets');

  const data = useAdminData(guildId, canManageAssets);
  const memberTable = useMemberTable(data.members, data.memberAssets);
  const overview = useGuildOverview(guildId);
  const profile = useGuildProfile();
  const announcementActions = useAnnouncementActions({
    guildId,
    onDraftDeleted: data.removeAnnouncement,
    onUnpublished: data.refetchAnnouncements,
  });

  return (
    <div className="space-y-5">
      <Tabs
        aria-label={t('sections')}
        selectedKey={selectedTab}
        onSelectionChange={key => router.replace(adminTabHref(adminTabFromParam(String(key))), { scroll: false })}
      >
        <Tabs.ListContainer>
          <Tabs.List>
            {TABS.map(tab => (
              <Tabs.Tab key={tab} id={tab}>
                <div className="flex items-center gap-2">
                  <span>{t(tab)}</span>
                  {tab === 'users' && (
                    <Chip size="sm" variant="secondary">
                      {data.members.length}
                    </Chip>
                  )}
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="inbox" className="pt-4">
          {!legacyHref && <AdminInbox guildId={guildId} />}
        </Tabs.Panel>

        <Tabs.Panel id="users" className="pt-4">
          <UsersPanel data={data} table={memberTable} canManageAssets={canManageAssets} />
        </Tabs.Panel>

        <Tabs.Panel id="guild" className="pt-4">
          <div className="space-y-4">
            <GuildStatsGrid
              guildStats={overview.guildStats}
              statsStatus={overview.statsStatus}
              retryStats={overview.retryStats}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <GuildSettingsCard profile={profile} canEditGuild={canEditGuild} />
              <RecentActivityCard
                recentActivity={overview.recentActivity}
                activityStatus={overview.activityStatus}
                retryActivity={overview.retryActivity}
              />
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="announcements" className="pt-4">
          <AnnouncementsPanel
            announcements={data.announcements}
            loadState={data.announcementsState}
            onRetry={data.reload}
            actions={announcementActions}
          />
        </Tabs.Panel>

        <Tabs.Panel id="templates" className="pt-4">
          <TemplateSettings guildId={guildId} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
