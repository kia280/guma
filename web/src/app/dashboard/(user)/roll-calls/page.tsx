'use client';

import { Button, Card, Chip, Tabs } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, CardGridSkeleton, EmptyContent } from '@/components/AsyncContent';
import { useCurrentGuildId } from '@/lib/current-guild';
import { useGuildPermissions } from '@/lib/permissions';
import { rollCallStatusColor } from '@/lib/status-colors';
import { RollCallStatus } from '@/types/roll-call';
import { CreateRollCallModal } from './_components/CreateRollCallModal';
import { RollCallCard } from './_components/RollCallCard';
import { useRollCallDraft } from './_hooks/useRollCallDraft';
import { useRollCalls } from './_hooks/useRollCalls';
import { useRollCallTemplates } from './_hooks/useRollCallTemplates';

const STATUS_TABS = [
  { id: 'all', status: null },
  { id: 'open', status: RollCallStatus.OPEN },
  { id: 'finished', status: RollCallStatus.FINISHED },
  { id: 'completed', status: RollCallStatus.COMPLETED },
  { id: 'cancelled', status: RollCallStatus.CANCELLED },
] as const;

const GRID_CLASS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

export default function RollCallsPage() {
  const t = useTranslations('rollCall');
  const nav = useTranslations('dashboardLayout');
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const { rollCalls, state, reload, refetch } = useRollCalls(guildId);
  const templates = useRollCallTemplates(guildId);
  const creation = useRollCallDraft({ guildId, templates: templates.templates, onCreated: refetch });

  const [activeTab, setActiveTab] = React.useState<string>('all');
  const tabLabels: Record<string, string> = {
    all: t('all'),
    open: t('statusActive'),
    finished: t('statusEnded'),
    completed: t('statusCompleted'),
    cancelled: t('statusCancelled'),
  };
  const countFor = (status: RollCallStatus | null) =>
    status === null ? rollCalls.length : rollCalls.filter(c => c.status === status).length;
  const activeStatus = STATUS_TABS.find(tab => tab.id === activeTab)?.status ?? null;
  const filtered = activeStatus === null ? rollCalls : rollCalls.filter(c => c.status === activeStatus);

  return (
    <div className="space-y-5">
      <h1 className="sr-only">{nav('rollCall')}</h1>
      {can('createRollCall') && <CreateRollCallModal creation={creation} templates={templates} />}

      <Tabs selectedKey={activeTab} onSelectionChange={key => setActiveTab(key as string)}>
        <div className="flex items-center gap-3">
          <Tabs.ListContainer className="min-w-0 flex-1">
            <Tabs.List aria-label={t('rollCalls')}>
              {STATUS_TABS.map(tab => (
                <Tabs.Tab key={tab.id} id={tab.id} className="max-sm:h-9">
                  <div className="flex items-center gap-2">
                    <span>{tabLabels[tab.id]}</span>
                    <Chip
                      size="sm"
                      color={tab.status === null ? 'default' : rollCallStatusColor[tab.status]}
                      variant="secondary"
                    >
                      {countFor(tab.status)}
                    </Chip>
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {can('createRollCall') && (
            <Button className="shrink-0 md:h-10 max-sm:size-11 max-sm:px-0" aria-label={t('addRollCall')} onPress={creation.open}>
              <Icon icon="solar:add-circle-linear" width={16} className="max-sm:hidden" />
              <Icon icon="solar:add-linear" width={20} className="sm:hidden" />
              <span className="max-sm:hidden">{t('addRollCall')}</span>
            </Button>
          )}
        </div>
        {STATUS_TABS.map(tab => (
          <Tabs.Panel key={tab.id} id={tab.id} className="pt-4">
            <AsyncContent state={state} onRetry={reload} skeleton={<CardGridSkeleton className={GRID_CLASS} />}>
              {filtered.length === 0 ? (
                <Card className="border border-transparent shadow-edge bg-surface">
                  <Card.Content>
                    <EmptyContent
                      icon="heroicons:clipboard-document-check"
                      title={t('noRollCalls')}
                      description={t('noRollCallsHint')}
                    />
                  </Card.Content>
                </Card>
              ) : (
                <div className={GRID_CLASS}>
                  {filtered.map(item => (
                    <RollCallCard
                      key={item.id}
                      status={item.status}
                      date={item.date}
                      title={item.title}
                      expireTime={item.expireTime}
                      attendanceCount={item.attendanceCount}
                      lootCount={item.lootList.length}
                      goldLoot={item.goldLoot?.total}
                      imageUrl={item.imageUrl}
                      isDisabled={item.isDisabled}
                      href={`/dashboard/roll-calls/${item.id}`}
                    />
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
