'use client';

import React from 'react';
import {
  Card,
  Button,
  Input,
  Avatar,
  Chip,
  TextArea,
  Separator,
  TextField,
  Label,
  InputGroup,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

export default function ProfilePage() {
  const t = useTranslations('profilePage');
  const [isEditing, setIsEditing] = React.useState(false);
  const [displayName, setDisplayName] = React.useState('John Doe');
  const [username, setUsername] = React.useState('johndoe');
  const [bio, setBio] = React.useState('Guild veteran. Raid leader on weekends.');

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-foreground/50 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Avatar */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Content className="flex flex-row items-center gap-5 p-5">
          <div className="relative shrink-0">
            <Avatar className="w-20 h-20 text-large">
              <Avatar.Image src="https://i.pravatar.cc/150?u=a04258114e29526708c" />
              <Avatar.Fallback>JD</Avatar.Fallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
              <Icon icon="solar:camera-linear" width={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-foreground">{displayName}</p>
            <Chip size="sm" variant="secondary" className="w-fit mt-0.5">
              {t('guildMember')}
            </Chip>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => setIsEditing(e => !e)}
            >
              {isEditing ? t('cancel') : t('editProfile')}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* Profile Details */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="text-primary" icon="solar:user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('profileDetails')}</p>
            <p className="text-xs text-foreground/40">{t('publicInfo')}</p>
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
                  <span className="text-foreground/40 text-sm">@</span>
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
            <div className="flex justify-end">
              <Button size="sm" variant="primary" onPress={() => setIsEditing(false)}>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-foreground/50" icon="solar:shield-user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('account')}</p>
            <p className="text-xs text-foreground/40">{t('accountSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:letter-linear" width={16} className="text-foreground/40 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('emailAddress')}</p>
                <p className="text-xs text-foreground/40">johndoe@example.com</p>
              </div>
            </div>
            <Chip size="sm" variant="secondary">
              {t('verified')}
            </Chip>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="ic:baseline-discord" width={16} className="text-foreground/40 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('discord')}</p>
                <p className="text-xs text-foreground/40">johndoe#1234</p>
              </div>
            </div>
            <Chip size="sm" variant="secondary">
              {t('connected')}
            </Chip>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:calendar-linear" width={16} className="text-foreground/40 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('memberSince')}</p>
                <p className="text-xs text-foreground/40">January 2024</p>
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
            <p className="text-sm font-medium text-foreground">{t('dangerZone')}</p>
            <p className="text-xs text-foreground/40">{t('dangerZoneSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">{t('deleteAccount')}</p>
              <p className="text-xs text-foreground/40">{t('deleteAccountDesc')}</p>
            </div>
            <Button size="sm" variant="danger">
              {t('deleteAccountBtn')}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
