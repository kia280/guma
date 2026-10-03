'use client';

import { Button, Card, Input, Label, Spinner, TextField } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { GuildAvatar } from '@/components/GuildAvatar';
import { GuildLogoPrompt } from '@/components/GuildLogoPrompt';
import { LOGO_TYPES } from '@/lib/logo-image';
import type { GuildProfile } from '../_hooks/useGuildProfile';

const GUILD_NAME_MAX_LENGTH = 100;

type GuildSettingsCardProps = {
  profile: GuildProfile;
  canEditGuild: boolean;
};

export function GuildSettingsCard({ profile, canEditGuild }: GuildSettingsCardProps) {
  const t = useTranslations('adminPage');
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const { guild } = profile;

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header>
        <div className="flex items-center gap-2">
          <Icon icon="solar:settings-linear" width={18} className="text-hint" />
          <p className="type-subheading text-foreground">{t('guildSettings')}</p>
        </div>
      </Card.Header>
      <Card.Content className="pt-0">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 py-2">
            <div className="relative shrink-0">
              <GuildAvatar size="lg" name={guild?.name} src={profile.logoPreview ?? guild?.icon} isLoading={!guild} />
              {profile.isUploadingLogo && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/70">
                  <Spinner size="sm" aria-label={t('uploadingLogo')} />
                </div>
              )}
            </div>
            <div className="min-w-0 basis-full order-last sm:order-none sm:basis-0 sm:flex-1">
              <p className="type-body text-subtle">{t('guildLogo')}</p>
              <p className="type-caption text-hint">{t('guildLogoHint')}</p>
              {profile.logoError && (
                <p role="alert" className="type-caption text-danger">{profile.logoError}</p>
              )}
            </div>
            {canEditGuild && (
              <div className="ml-auto flex shrink-0 gap-2 sm:ml-0">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={LOGO_TYPES.join(',')}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void profile.uploadLogo(file);
                  }}
                />
                {guild?.icon && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isPending={profile.isRemovingLogo}
                    isDisabled={profile.isUploadingLogo}
                    onPress={profile.removeLogo}
                  >
                    {t('removeLogo')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  isPending={profile.isUploadingLogo}
                  isDisabled={!guild || profile.isRemovingLogo}
                  onPress={() => logoInputRef.current?.click()}
                >
                  <Icon icon="solar:upload-linear" width={16} aria-hidden />
                  {t('uploadLogo')}
                </Button>
              </div>
            )}
          </div>
          {canEditGuild && <GuildLogoPrompt guildName={guild?.name ?? ''} />}
          <div className="flex items-center justify-between gap-3 py-2">
            {profile.isEditingName ? (
              <form
                className="flex flex-1 flex-wrap items-end gap-2"
                onSubmit={event => {
                  event.preventDefault();
                  profile.saveName();
                }}
              >
                <TextField className="flex-1 min-w-48" isRequired>
                  <Label>{t('guildName')}</Label>
                  <Input
                    variant="secondary"
                    value={profile.nameDraft}
                    maxLength={GUILD_NAME_MAX_LENGTH}
                    onChange={event => profile.setNameDraft(event.target.value)}
                    autoFocus
                  />
                </TextField>
                <Button size="sm" variant="secondary" onPress={profile.cancelEditingName}>
                  {t('cancel')}
                </Button>
                <Button size="sm" type="submit" isPending={profile.isSavingName} isDisabled={!profile.nameDraft.trim()}>
                  {t('save')}
                </Button>
              </form>
            ) : (
              <>
                <div className="min-w-0">
                  <p className="type-body text-subtle">{t('guildName')}</p>
                  <p className="type-body font-medium text-foreground truncate">{guild?.name ?? '—'}</p>
                </div>
                {canEditGuild && (
                  <Button size="sm" variant="secondary" isDisabled={!guild} onPress={profile.startEditingName}>
                    {t('edit')}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="py-2">
            <p className="type-body text-subtle">{t('recruitment')}</p>
            <p className="type-body font-medium text-foreground">
              {guild ? (guild.settings.isPublic ? t('recruitmentOpen') : t('recruitmentClosed')) : '—'}
            </p>
            <p className="type-caption text-hint">{t('recruitmentHint')}</p>
          </div>
        </div>
      </Card.Content>
    </Card>
  );
}
