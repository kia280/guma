'use client';

import { Card, Description, Input, Label, Switch, Tabs, TextArea, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import type { AnnouncementDraftInput } from '@/types/admin';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 20000;

type AnnouncementFieldsProps = {
  values: AnnouncementDraftInput;
  onChange: (patch: Partial<AnnouncementDraftInput>) => void;
};

export function AnnouncementFields({ values, onChange }: AnnouncementFieldsProps) {
  const t = useTranslations('adminPage');
  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Content className="p-4 sm:p-6 flex flex-col gap-4">
        <TextField
          value={values.title}
          onChange={title => onChange({ title })}
          maxLength={MAX_TITLE_LENGTH}
          autoFocus={values.title === ''}
        >
          <Label>{t('announcementTitle')}</Label>
          <Input placeholder={t('announcementTitlePlaceholder')} variant="secondary" />
        </TextField>

        <Tabs variant="secondary" aria-label={t('announcementContent')}>
          <Tabs.ListContainer>
            <Tabs.List aria-label={t('announcementContent')}>
              <Tabs.Tab id="write">
                {t('write')}
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="preview">
                {t('preview')}
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="write" className="pt-3">
            <TextField
              value={values.content}
              onChange={content => onChange({ content })}
              maxLength={MAX_CONTENT_LENGTH}
            >
              <Label>{t('announcementContent')}</Label>
              <TextArea placeholder={t('announcementContentPlaceholder')} variant="secondary" rows={12} />
              <Description>{t('contentLength', { count: values.content.length, max: MAX_CONTENT_LENGTH })}</Description>
            </TextField>
          </Tabs.Panel>
          <Tabs.Panel id="preview" className="pt-3">
            <div className="min-h-64 rounded-lg border border-divider p-4">
              {values.content.trim() ? (
                <DiscordMarkdown content={values.content} className="type-prose text-foreground" />
              ) : (
                <EmptyContent icon="solar:document-text-linear" title={t('nothingToPreview')} />
              )}
            </div>
          </Tabs.Panel>
        </Tabs>
        <p className="type-caption text-hint">{t('markdownHint')}</p>

        <Switch
          isSelected={values.pinned}
          onChange={pinned => onChange({ pinned })}
          size="sm"
          aria-labelledby="announcement-pin-label"
          aria-describedby="announcement-pin-description"
          className="w-full"
        >
          <Switch.Content className="w-full min-h-11 justify-between gap-3 font-normal">
            <span>
              <span id="announcement-pin-label" className="block type-body text-foreground">{t('pinAnnouncement')}</span>
              <span id="announcement-pin-description" className="block type-caption text-hint">{t('pinNote')}</span>
            </span>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </Card.Content>
    </Card>
  );
}
