'use client';

import React from 'react';
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Avatar,
  Chip,
  Textarea,
  Divider,
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
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-default-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Avatar */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardBody className="flex flex-row items-center gap-5 p-5">
          <div className="relative shrink-0">
            <Avatar
              src="https://i.pravatar.cc/150?u=a04258114e29526708c"
              className="w-20 h-20 text-large"
            />
            <button className="absolute bottom-0 right-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white shadow-sm hover:bg-primary/90 transition-colors">
              <Icon icon="solar:camera-linear" width={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-foreground">{displayName}</p>
            <p className="text-sm text-default-500">@{username}</p>
            <Chip size="sm" variant="flat" color="primary" className="w-fit mt-0.5">
              {t('guildMember')}
            </Chip>
          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              variant={isEditing ? 'flat' : 'bordered'}
              onPress={() => setIsEditing(e => !e)}
            >
              {isEditing ? t('cancel') : t('editProfile')}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Profile Details */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="text-primary" icon="solar:user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('profileDetails')}</p>
            <p className="text-xs text-default-400">{t('publicInfo')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('displayName')}
              value={displayName}
              onValueChange={setDisplayName}
              isReadOnly={!isEditing}
              variant={isEditing ? 'bordered' : 'flat'}
              classNames={{ inputWrapper: !isEditing ? 'bg-transparent shadow-none' : '' }}
            />
            <Input
              label={t('username')}
              value={username}
              onValueChange={setUsername}
              isReadOnly={!isEditing}
              variant={isEditing ? 'bordered' : 'flat'}
              startContent={<span className="text-default-400 text-sm">@</span>}
              classNames={{ inputWrapper: !isEditing ? 'bg-transparent shadow-none' : '' }}
            />
          </div>
          <Textarea
            label={t('bio')}
            value={bio}
            onValueChange={setBio}
            isReadOnly={!isEditing}
            variant={isEditing ? 'bordered' : 'flat'}
            minRows={2}
            classNames={{ inputWrapper: !isEditing ? 'bg-transparent shadow-none' : '' }}
          />
          {isEditing && (
            <div className="flex justify-end">
              <Button
                color="primary"
                size="sm"
                onPress={() => setIsEditing(false)}
                startContent={<Icon icon="solar:check-circle-linear" width={16} />}
              >
                {t('saveChanges')}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Account Info */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:shield-user-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('account')}</p>
            <p className="text-xs text-default-400">{t('accountSubtitle')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-3">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:letter-linear" width={16} className="text-default-400 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('emailAddress')}</p>
                <p className="text-xs text-default-400">johndoe@example.com</p>
              </div>
            </div>
            <Chip size="sm" variant="flat" color="success">
              {t('verified')}
            </Chip>
          </div>
          <Divider />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="ic:baseline-discord" width={16} className="text-default-400 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('discord')}</p>
                <p className="text-xs text-default-400">johndoe#1234</p>
              </div>
            </div>
            <Chip size="sm" variant="flat" color="secondary">
              {t('connected')}
            </Chip>
          </div>
          <Divider />
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Icon icon="solar:calendar-linear" width={16} className="text-default-400 shrink-0" />
              <div>
                <p className="text-sm text-foreground">{t('memberSince')}</p>
                <p className="text-xs text-default-400">January 2024</p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className="border border-danger/20 shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 shrink-0">
            <Icon className="text-danger" icon="solar:danger-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('dangerZone')}</p>
            <p className="text-xs text-default-400">{t('dangerZoneSubtitle')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">{t('deleteAccount')}</p>
              <p className="text-xs text-default-400">{t('deleteAccountDesc')}</p>
            </div>
            <Button size="sm" color="danger" variant="flat">
              {t('deleteAccountBtn')}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
