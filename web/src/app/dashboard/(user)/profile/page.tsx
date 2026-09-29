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
  Description,
  FieldError,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { UserAvatar } from '@/components/UserAvatar';
import { useToast } from '@/hooks/useToast';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { isGuildRole, roleChipColor } from '@/lib/permissions';
import { useUserStore } from '@/lib/store';
import { ownUserName } from '@/lib/user-name';

const NAME_MAX_LENGTH = 32;
const BIO_MAX_LENGTH = 500;

const normalizeField = (value: string) => value.trim().normalize('NFC');

type DraftErrors = {
  displayName?: string;
  bio?: string;
};

export default function ProfilePage() {
  const t = useTranslations('profilePage');
  const format = useIntlFormatter();
  const user = useUserStore(state => state.user);
  const setUser = useUserStore(state => state.setUser);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const notify = useToast();
  const [saveError, setSaveError] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [nameTaken, setNameTaken] = React.useState('');

  const resetDraft = React.useCallback(() => {
    setDisplayName(ownUserName(user));
    setBio(user?.bio ?? '');
    setNameTaken('');
    setSaveError('');
  }, [user]);

  const draftErrors = React.useMemo<DraftErrors>(() => {
    const errors: DraftErrors = {};
    const trimmedDisplayName = normalizeField(displayName);
    if (!trimmedDisplayName) {
      errors.displayName = t('nameRequired');
    } else if ([...trimmedDisplayName].length > NAME_MAX_LENGTH) {
      errors.displayName = t('nameTooLong', { max: NAME_MAX_LENGTH });
    } else if (nameTaken && trimmedDisplayName.toLocaleLowerCase() === nameTaken.toLocaleLowerCase()) {
      errors.displayName = t('nameTaken');
    }
    if ([...normalizeField(bio)].length > BIO_MAX_LENGTH) {
      errors.bio = t('bioTooLong', { max: BIO_MAX_LENGTH });
    }
    return errors;
  }, [displayName, bio, nameTaken, t]);

  const hasDraftErrors = Object.keys(draftErrors).length > 0;

  React.useEffect(() => {
    if (!isEditing) resetDraft();
  }, [isEditing, resetDraft]);

  const toggleEditing = () => {
    if (isEditing) resetDraft();
    setIsEditing(editing => !editing);
  };

  const saveProfile = async () => {
    if (hasDraftErrors) {
      setSaveError(t('saveInvalid'));
      return;
    }
    setIsSaving(true);
    setSaveError('');
    const trimmedDisplayName = normalizeField(displayName);
    try {
      const updated = await apiClient.updateMe({
        displayName: trimmedDisplayName,
        bio: normalizeField(bio),
      });
      setUser(updated);
      setIsEditing(false);
      notify.success(t('saveSuccess'));
    } catch (err) {
      switch (apiErrorCode(err)) {
        case GrpcCode.AlreadyExists:
          setNameTaken(trimmedDisplayName);
          setSaveError(t('saveInvalid'));
          break;
        case GrpcCode.InvalidArgument:
          setSaveError(t('saveInvalid'));
          break;
        default:
          setSaveError(t('saveFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const shownName = ownUserName(user);
  const guildRole = user?.guildRole ?? '';
  const roleLabel = isGuildRole(guildRole) ? t(`roles.${guildRole}`) : guildRole;
  const roleColor = roleChipColor(guildRole);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header */}
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Avatar */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Content className="flex flex-row flex-wrap items-center gap-4 sm:flex-nowrap sm:gap-5 p-4 sm:p-5">
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
          <div className="flex flex-col gap-1 flex-1 min-w-0 type-caption">
            <p className="type-subheading text-foreground line-clamp-2 wrap-anywhere">{shownName}</p>
            {guildRole && (
              <Chip size="sm" variant="secondary" color={roleColor} className="w-fit mt-0.5 whitespace-nowrap">
                {roleLabel}
              </Chip>
            )}
          </div>
          <div className="w-full sm:w-auto sm:shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="max-sm:h-11 max-sm:w-full"
              onPress={toggleEditing}
            >
              {isEditing ? t('cancel') : t('editProfile')}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Profile Details */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('profileDetails')}</p>
            <p className="type-caption text-hint">{t('publicInfo')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-4">
          {isEditing ? (
            <>
              <TextField isRequired isInvalid={!!draftErrors.displayName}>
                <Label>{t('name')}</Label>
                <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
                {draftErrors.displayName ? (
                  <FieldError>{draftErrors.displayName}</FieldError>
                ) : (
                  <Description>{t('nameHint', { max: NAME_MAX_LENGTH })}</Description>
                )}
              </TextField>
              <TextField isInvalid={!!draftErrors.bio}>
                <Label>{t('bio')}</Label>
                <TextArea value={bio} onChange={e => setBio(e.target.value)} rows={4} />
                {draftErrors.bio && <FieldError>{draftErrors.bio}</FieldError>}
              </TextField>
            </>
          ) : (
            <dl className="flex flex-col gap-4 type-body">
              <div className="flex flex-col gap-1">
                <dt className="type-label text-soft">{t('name')}</dt>
                <dd className="text-foreground wrap-anywhere">{shownName}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="type-label text-soft">{t('bio')}</dt>
                <dd className={`whitespace-pre-line wrap-break-word ${user?.bio ? 'text-foreground' : 'text-hint'}`}>
                  {user?.bio || t('bioEmpty')}
                </dd>
              </div>
            </dl>
          )}
          {isEditing && (
            <div className="flex items-center justify-end gap-3">
              {saveError && (
                <p role="alert" className="type-caption text-danger">
                  {saveError}
                </p>
              )}
              <Button
                size="sm"
                variant="primary"
                isPending={isSaving}
                isDisabled={hasDraftErrors}
                onPress={saveProfile}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Icon icon="solar:check-circle-linear" width={16} />
                    )}
                    {t('saveChanges')}
                  </>
                )}
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Account Info */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:shield-user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('account')}</p>
            <p className="type-caption text-hint">{t('accountSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 py-2 type-body">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Icon icon="solar:letter-linear" width={16} className="text-hint shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="type-body text-foreground">{t('emailAddress')}</p>
                <p className="type-caption text-hint truncate" title={user?.email || undefined}>
                  {user?.email || '—'}
                </p>
              </div>
            </div>
            {user?.emailVerified === true && (
              <Chip size="sm" variant="secondary" color="success" className="shrink-0">
                {t('verified')}
              </Chip>
            )}
            {user?.emailVerified === false && (
              <Chip size="sm" variant="secondary" color="warning" className="shrink-0">
                {t('unverified')}
              </Chip>
            )}
          </div>
          <Separator />
          {user?.discord && (
            <>
              <div className="flex items-center justify-between gap-3 py-2 type-body">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon icon="ic:baseline-discord" width={16} className="text-hint shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="type-body text-foreground">{t('discord')}</p>
                    {user.discord.username && (
                      <p className="type-caption text-hint truncate" title={user.discord.username}>
                        {user.discord.username}
                      </p>
                    )}
                  </div>
                </div>
                <Chip size="sm" variant="secondary" color="success" className="shrink-0">
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
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
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
