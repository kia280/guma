'use client';

import {
  Card,
  Button,
  Input,
  Chip,
  TextArea,
  Separator,
  TextField,
  Label,
  InputGroup,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { apiClient } from '@/lib/guma';
import { useUserStore } from '@/lib/store';

const ROLE_COLORS = {
  owner: 'accent',
  admin: 'danger',
  moderator: 'warning',
  member: 'default',
} as const;

type KnownRole = keyof typeof ROLE_COLORS;

const isKnownRole = (role: string): role is KnownRole => role in ROLE_COLORS;

export default function ProfilePage() {
  const t = useTranslations('profilePage');
  const format = useIntlFormatter();
  const user = useUserStore(state => state.user);
  const setUser = useUserStore(state => state.setUser);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [bio, setBio] = React.useState('');

  const resetDraft = React.useCallback(() => {
    setDisplayName(user?.displayName ?? '');
    setUsername(user?.username ?? '');
    setBio(user?.bio ?? '');
    setSaveError('');
  }, [user]);

  React.useEffect(() => {
    if (!isEditing) resetDraft();
  }, [isEditing, resetDraft]);

  const toggleEditing = () => {
    if (isEditing) resetDraft();
    setIsEditing(editing => !editing);
  };

  const saveProfile = async () => {
    setIsSaving(true);
    setSaveError('');
    try {
      const updated = await apiClient.updateMe({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      setUser(updated);
      setIsEditing(false);
    } catch {
      setSaveError(t('saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const shownName = user?.displayName || user?.username || '';
  const guildRole = user?.guildRole ?? '';
  const roleLabel = isKnownRole(guildRole) ? t(`roles.${guildRole}`) : guildRole;
  const roleColor = isKnownRole(guildRole) ? ROLE_COLORS[guildRole] : 'default';

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header */}
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Avatar */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Content className="flex flex-row items-center gap-4 sm:gap-5 p-4 sm:p-5">
          <div className="relative shrink-0">
            <UserAvatar
              name={shownName}
              src={user?.avatarUrl}
              size="lg"
              className="size-16 sm:size-20"
              fallbackClassName="type-heading"
            />
            <button
              type="button"
              disabled
              aria-label={t('changeAvatarSoon')}
              title={t('changeAvatarSoon')}
              className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-foreground shadow-sm opacity-60 cursor-not-allowed"
            >
              <Icon icon="solar:camera-linear" width={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <p className="type-subheading text-foreground truncate">{shownName}</p>
            {guildRole && (
              <Chip size="sm" variant="secondary" color={roleColor} className="w-fit mt-0.5 whitespace-nowrap">
                {roleLabel}
              </Chip>
            )}
          </div>
          <div className="shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onPress={toggleEditing}
            >
              {isEditing ? t('cancel') : t('editProfile')}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Profile Details */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('profileDetails')}</p>
            <p className="type-caption text-hint">{t('publicInfo')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField isReadOnly={!isEditing}>
              <Label>{t('displayName')}</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </TextField>
            <TextField isReadOnly={!isEditing}>
              <Label>{t('username')}</Label>
              <InputGroup>
                <InputGroup.Prefix>
                  <span className="text-hint type-body">@</span>
                </InputGroup.Prefix>
                <InputGroup.Input value={username} onChange={e => setUsername(e.target.value)} />
              </InputGroup>
            </TextField>
          </div>
          <TextField isReadOnly={!isEditing}>
            <Label>{t('bio')}</Label>
            <TextArea value={bio} onChange={e => setBio(e.target.value)} rows={2} />
          </TextField>
          {isEditing && (
            <div className="flex items-center justify-end gap-3">
              {saveError && (
                <p role="alert" className="type-caption text-danger">
                  {saveError}
                </p>
              )}
              <Button size="sm" variant="primary" isPending={isSaving} onPress={saveProfile}>
                <Icon icon="solar:check-circle-linear" width={16} />
                {t('saveChanges')}
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Account Info */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:shield-user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('account')}</p>
            <p className="type-caption text-hint">{t('accountSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:letter-linear" width={16} className="text-hint shrink-0" />
              <div>
                <p className="type-body text-foreground">{t('emailAddress')}</p>
                <p className="type-caption text-hint">{user?.email || '—'}</p>
              </div>
            </div>
            {user?.emailVerified === true && (
              <Chip size="sm" variant="secondary" color="success">
                {t('verified')}
              </Chip>
            )}
            {user?.emailVerified === false && (
              <Chip size="sm" variant="secondary" color="warning">
                {t('unverified')}
              </Chip>
            )}
          </div>
          <Separator />
          {user?.discord && (
            <>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Icon icon="ic:baseline-discord" width={16} className="text-hint shrink-0" />
                  <div>
                    <p className="type-body text-foreground">{t('discord')}</p>
                    {user.discord.username && (
                      <p className="type-caption text-hint">{user.discord.username}</p>
                    )}
                  </div>
                </div>
                <Chip size="sm" variant="secondary" color="success">
                  {t('connected')}
                </Chip>
              </div>
              <Separator />
            </>
          )}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:calendar-linear" width={16} className="text-hint shrink-0" />
              <div>
                <p className="type-body text-foreground">{t('memberSince')}</p>
                <p className="type-caption text-hint">
                  {user?.createdAt ? format.dateTime(new Date(user.createdAt), { year: 'numeric', month: 'long' }) : '—'}
                </p>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-danger/20 shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 shrink-0">
            <Icon className="text-danger" icon="solar:danger-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('dangerZone')}</p>
            <p className="type-caption text-hint">{t('dangerZoneSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="type-body text-foreground">{t('deleteAccount')}</p>
              <p className="type-caption text-hint">{t('deleteAccountDesc')}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Button size="sm" variant="danger" isDisabled>
                {t('deleteAccountBtn')}
              </Button>
              <span className="type-caption text-hint">{t('comingSoon')}</span>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
