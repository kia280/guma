'use client';

import React from 'react';
import { Tabs } from '@heroui/react';
import { useTranslations } from 'next-intl';

import { CheckinTemplateManager } from '@/components/CheckinTemplateManager';
import { ItemTemplateManager } from '@/components/ItemTemplateManager';

export function TemplateSettings({ guildId }: { guildId: string }) {
  const t = useTranslations('templates');

  return (
    <Tabs variant="secondary">
      <Tabs.ListContainer>
        <Tabs.List aria-label={t('kindLabel')}>
          <Tabs.Tab id="checkin">
            {t('checkinTab')}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="item">
            {t('itemTab')}
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="checkin" className="pt-4">
        <CheckinTemplateManager guildId={guildId} />
      </Tabs.Panel>
      <Tabs.Panel id="item" className="pt-4">
        <ItemTemplateManager guildId={guildId} />
      </Tabs.Panel>
    </Tabs>
  );
}
