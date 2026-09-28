'use client';

import { Tabs } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemTemplateManager } from '@/components/ItemTemplateManager';
import { RollCallTemplateManager } from '@/components/RollCallTemplateManager';

export function TemplateSettings({ guildId }: { guildId: string }) {
  const t = useTranslations('templates');

  return (
    <Tabs variant="secondary">
      <Tabs.ListContainer>
        <Tabs.List aria-label={t('kindLabel')}>
          <Tabs.Tab id="rollCall">
            {t('rollCallTab')}
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="item">
            {t('itemTab')}
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="rollCall" className="pt-4">
        <RollCallTemplateManager guildId={guildId} />
      </Tabs.Panel>
      <Tabs.Panel id="item" className="pt-4">
        <ItemTemplateManager guildId={guildId} />
      </Tabs.Panel>
    </Tabs>
  );
}
