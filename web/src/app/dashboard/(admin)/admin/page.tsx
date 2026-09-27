'use client';

import {
  Tabs,
  Card,
  Table,
  Chip,
  Button,
  Input,
  Separator,
  TextField,
  Label,
  Skeleton,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import { BankRequestReview } from '@/components/BankRequestReview';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { GuildAvatar } from '@/components/GuildAvatar';
import { GuildLogoPrompt } from '@/components/GuildLogoPrompt';
import { TemplateSettings } from '@/components/TemplateSettings';
import { UserAvatar } from '@/components/UserAvatar';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { HTML_LANG, isLocale } from '@/i18n/locales';
import { useCurrentGuildId } from '@/lib/current-guild';
import { adminTabFromParam, adminTabHref } from '@/lib/dashboard-nav';
import { apiClient } from '@/lib/guma';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { LOGO_TYPES, LogoImageError, prepareLogo } from '@/lib/logo-image';
import { roleChipColor, useGuildPermissions } from '@/lib/permissions';
import { userStatusColor, type UserStatus } from '@/lib/status-colors';
import { useCurrentGuild, useCurrentGuildStore } from '@/lib/store';
import type { AdminActivity, AdminAnnouncement, AdminGuildStats } from '@/types/admin';
import type { MockUser } from '@/types/user';


const STATUSES = ['online', 'offline', 'banned'] as const;
const ROLES = ['owner', 'admin', 'moderator', 'member'] as const;

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const formatRelative = (date: Date, intlLocale: string) => {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(seconds, 'second');
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'auction':
      return 'solar:sledgehammer-linear';
    case 'checkin':
      return 'solar:clipboard-check-linear';
    case 'lottery':
      return 'solar:ticket-linear';
    case 'join':
      return 'solar:user-plus-linear';
    default:
      return 'solar:info-circle-linear';
  }
};

const getActivityColor = (type: string) => {
  switch (type) {
    case 'auction':
      return 'text-warning';
    case 'checkin':
      return 'text-success';
    case 'lottery':
      return 'text-accent';
    case 'join':
      return 'text-subtle';
    default:
      return 'text-hint';
  }
};

export default function AdminPage() {
  const t = useTranslations('adminPage');
  const formatGold = useFormatGold();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTab = adminTabFromParam(searchParams.get('tab'));
  const focusRequestId = searchParams.get('request');
  const intlLocale = isLocale(locale) ? HTML_LANG[locale] : locale;
  const formatLastActive = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())
      ? formatRelative(date, intlLocale)
      : value;
  };
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const canEditGuild = can('editGuild');

  const [mockUsers, setMockUsers] = React.useState<MockUser[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<AdminActivity[]>([]);
  const [activityStatus, setActivityStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [activityReloadKey, setActivityReloadKey] = React.useState(0);
  const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([]);
  const [guildStats, setGuildStats] = React.useState<AdminGuildStats | null>(null);
  const [statsStatus, setStatsStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [statsReloadKey, setStatsReloadKey] = React.useState(0);
  const usersState = useLoadState();
  const announcementsState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    usersState.reset();
    announcementsState.reset();
    setReloadKey(key => key + 1);
  }, [usersState.reset, announcementsState.reset]);
  const { guild } = useCurrentGuild();
  const setGuild = useCurrentGuildStore(s => s.setGuild);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [guildNameDraft, setGuildNameDraft] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);

  const startEditingName = () => {
    setGuildNameDraft(guild?.name ?? '');
    setIsEditingName(true);
  };

  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = React.useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = React.useState(false);
  const [logoError, setLogoError] = React.useState<string | null>(null);

  React.useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const logoErrorMessage = (err: unknown) => {
    if (err instanceof LogoImageError) {
      if (err.code === 'invalid-type') return t('logoInvalidType');
      if (err.code === 'too-large') return t('logoTooLarge');
      return t('logoInvalid');
    }
    const status = isAxiosError(err) ? err.response?.status : undefined;
    if (status === 403) return t('logoPermissionDenied');
    if (status === 400) return t('logoInvalid');
    return t('logoUploadFailed');
  };

  const uploadLogo = async (file: File) => {
    if (!guild) return;
    setLogoError(null);
    setIsUploadingLogo(true);
    try {
      const image = await prepareLogo(file);
      setLogoPreview(URL.createObjectURL(image));
      setGuild(await apiClient.uploadGuildLogo(guild.id, image));
    } catch (err) {
      setLogoError(logoErrorMessage(err));
    } finally {
      setIsUploadingLogo(false);
      setLogoPreview(null);
    }
  };

  const removeLogo = async () => {
    if (!guild) return;
    setLogoError(null);
    setIsRemovingLogo(true);
    try {
      setGuild(await apiClient.deleteGuildLogo(guild.id));
    } catch (err) {
      setLogoError(logoErrorMessage(err));
    } finally {
      setIsRemovingLogo(false);
    }
  };

  const saveGuildName = async () => {
    const name = guildNameDraft.trim();
    if (!guild || !name) return;
    setIsSavingName(true);
    try {
      setGuild(await apiClient.updateGuild(guild.id, { name }));
      setIsEditingName(false);
      notify.success(t('guildNameSaved'));
    } catch {
      notify.error(t('guildNameFailed'));
    } finally {
      setIsSavingName(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .listMembers(guildId)
      .then(d => {
        if (cancelled) return;
        setMockUsers(d);
        usersState.ready();
      })
      .catch(() => {
        if (cancelled) return;
        usersState.failed();
        notify.loadFailed(reload, 'admin');
      });
    apiClient
      .getAdminAnnouncements(guildId)
      .then(d => {
        if (cancelled) return;
        setAnnouncements(d);
        announcementsState.ready();
      })
      .catch(() => {
        if (cancelled) return;
        announcementsState.failed();
        notify.loadFailed(reload, 'admin');
      });
    return () => { cancelled = true; };
  }, [
    guildId,
    reloadKey,
    notify,
    reload,
    usersState.ready,
    usersState.failed,
    announcementsState.ready,
    announcementsState.failed,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getAdminActivity()
      .then(d => {
        if (cancelled) return;
        setRecentActivity(d);
        setActivityStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setActivityStatus('error');
      });
    return () => { cancelled = true; };
  }, [guildId, activityReloadKey]);

  const retryActivity = () => {
    setActivityStatus('loading');
    setActivityReloadKey(key => key + 1);
  };

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .getGuildStats(guildId)
      .then(d => {
        if (cancelled) return;
        setGuildStats(d);
        setStatsStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatsStatus('error');
      });
    return () => { cancelled = true; };
  }, [guildId, statsReloadKey]);

  const retryStats = () => {
    setStatsStatus('loading');
    setStatsReloadKey(key => key + 1);
  };

  const refetchStats = React.useCallback(() => {
    apiClient.getGuildStats(guildId).then(d => {
      setGuildStats(d);
      setStatsStatus('ready');
    }).catch(() => {});
  }, [guildId]);

  useLiveResource(['bank'], refetchStats, { guildId });

  const formatCount = (value: number) => new Intl.NumberFormat(intlLocale).format(value);

  const statCards = [
    {
      key: 'members',
      label: t('totalMembers'),
      value: guildStats ? formatCount(guildStats.memberCount) : '',
      icon: 'solar:users-group-rounded-linear',
      color: 'text-accent',
      bg: 'bg-accent/10',
    },
    {
      key: 'balance',
      label: t('guildBalance'),
      value: guildStats ? formatGold(guildStats.bankBalance) : '',
      icon: 'solar:wallet-money-linear',
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      key: 'events',
      label: t('activeEvents'),
      value: guildStats ? formatCount(guildStats.activeEventCount) : '',
      icon: 'solar:calendar-linear',
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      key: 'items',
      label: t('totalItems'),
      value: guildStats ? formatCount(guildStats.bankItemCount) : '',
      icon: 'solar:backpack-linear',
      color: 'text-subtle',
      bg: 'bg-default',
    },
  ];

  const refetchAnnouncements = React.useCallback(() => {
    apiClient
      .getAdminAnnouncements(guildId)
      .then(setAnnouncements)
      .catch(() => notify.loadFailed(reload, 'admin'));
  }, [guildId, notify, reload]);

  useLiveResource(['announcement'], refetchAnnouncements, { guildId });

  const [isCreatingDraft, setIsCreatingDraft] = React.useState(false);
  const [createDraftFailed, setCreateDraftFailed] = React.useState(false);
  const [draftToDelete, setDraftToDelete] = React.useState<AdminAnnouncement | null>(null);
  const [toUnpublish, setToUnpublish] = React.useState<AdminAnnouncement | null>(null);

  const handlePostAnnouncement = async () => {
    setIsCreatingDraft(true);
    setCreateDraftFailed(false);
    try {
      const draft = await apiClient.createAnnouncementDraft(guildId);
      router.push(`/dashboard/admin/announcements/${draft.id}`);
    } catch {
      setCreateDraftFailed(true);
      setIsCreatingDraft(false);
    }
  };

  const deleteDraft = async (draft: AdminAnnouncement) => {
    await apiClient.deleteAnnouncementDraft(guildId, draft.id);
    setAnnouncements(prev => prev.filter(a => a.id !== draft.id));
    notify.success(t('draftDeleted'));
  };

  const unpublish = async (ann: AdminAnnouncement) => {
    await apiClient.unpublishAnnouncement(guildId, ann.id);
    refetchAnnouncements();
    notify.success(t('announcementUnpublished'));
  };

  return (
    <div className="space-y-5">
      <Tabs
        aria-label={t('sections')}
        selectedKey={selectedTab}
        onSelectionChange={key => router.replace(adminTabHref(adminTabFromParam(String(key))), { scroll: false })}
      >
        <Tabs.ListContainer>
          <Tabs.List>
            <Tabs.Tab id="users">
              <div className="flex items-center gap-2">
                <span>{t('users')}</span>
                <Chip size="sm" variant="secondary">
                  {mockUsers.length}
                </Chip>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="bankRequests">
              <div className="flex items-center gap-2">
                <span>{t('bankRequests')}</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="templates">
              <div className="flex items-center gap-2">
                <span>{t('templates')}</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="guild">
              <div className="flex items-center gap-2">
                <span>{t('guild')}</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="announcements">
              <div className="flex items-center gap-2">
                <span>{t('announcements')}</span>
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Users Panel */}
        <Tabs.Panel id="users" className="pt-4">
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Content className="p-0">
              <AsyncContent
                state={usersState.state}
                onRetry={reload}
                skeleton={<div className="p-4"><ListSkeleton rows={5} /></div>}
              >
              {mockUsers.length === 0 ? (
                <EmptyContent icon="solar:users-group-rounded-linear" title={t('noUsers')} />
              ) : (
              <Table variant="secondary">
                <Table.ScrollContainer>
                  <Table.Content aria-label={t('usersTable')}>
                    <Table.Header>
                      <Table.Column isRowHeader>{t('user')}</Table.Column>
                      <Table.Column className="max-md:rounded-r-2xl">{t('role')}</Table.Column>
                      <Table.Column className="hidden md:table-cell">{t('status')}</Table.Column>
                      <Table.Column className="hidden md:table-cell">{t('lastActive')}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {mockUsers.map(user => (
                        <Table.Row key={user.id}>
                          <Table.Cell>
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar name={user.username} src={user.avatar} className="shrink-0" />
                              <div className="min-w-0">
                                <p className="type-body font-medium text-foreground truncate">
                                  {user.username}
                                </p>
                                <p className="type-caption text-hint truncate hidden sm:block">{user.email}</p>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" color={roleChipColor(user.role)} variant="secondary" className="capitalize">
                              {user.role && ROLES.includes(user.role as (typeof ROLES)[number])
                                ? t(`roles.${user.role as (typeof ROLES)[number]}`)
                                : user.role}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <Chip
                              size="sm"
                              variant="secondary"
                              color={userStatusColor[user.status as UserStatus] ?? 'default'}
                              className="capitalize"
                            >
                              {user.status && STATUSES.includes(user.status as (typeof STATUSES)[number])
                                ? t(`statuses.${user.status as (typeof STATUSES)[number]}`)
                                : user.status}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <p className="type-body text-subtle">{formatLastActive(user.lastActive)}</p>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Content>
                </Table.ScrollContainer>
              </Table>
              )}
              </AsyncContent>
            </Card.Content>
          </Card>
        </Tabs.Panel>

        {/* Guild Panel */}
        <Tabs.Panel id="guild" className="pt-4">
          <div className="space-y-4">
            {/* Overview stats */}
            {statsStatus === 'error' ? (
              <Card className="border border-divider shadow-none bg-surface">
                <Card.Content className="p-4">
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon icon="solar:danger-circle-linear" width={18} className="text-danger" aria-hidden />
                      <p className="type-body text-subtle">{t('statsLoadError')}</p>
                    </div>
                    <Button size="sm" variant="secondary" onPress={retryStats}>
                      <Icon icon="solar:restart-linear" width={16} aria-hidden />
                      {t('retry')}
                    </Button>
                  </div>
                </Card.Content>
              </Card>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-busy={statsStatus === 'loading'}>
                {statsStatus === 'loading' && <span className="sr-only">{t('loadingStats')}</span>}
                {statCards.map(stat => (
                  <Card key={stat.key} className="border border-divider shadow-none bg-surface">
                    <Card.Content>
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                        <div className={`${stat.bg} p-2 rounded-lg shrink-0`}>
                          <Icon icon={stat.icon} width={18} className={stat.color} aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <p className="type-caption text-hint">{stat.label}</p>
                          {statsStatus === 'loading' ? (
                            <Skeleton className="mt-1 h-7 w-20 rounded-lg" />
                          ) : (
                            <p className="type-heading sm:type-title tabular-nums text-foreground wrap-anywhere">{stat.value}</p>
                          )}
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {/* Guild Settings placeholder */}
              <Card className="border border-divider shadow-none bg-surface">
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
                        <GuildAvatar size="lg" name={guild?.name} src={logoPreview ?? guild?.icon} isLoading={!guild} />
                        {isUploadingLogo && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-surface/70">
                            <Spinner size="sm" aria-label={t('uploadingLogo')} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="type-body text-subtle">{t('guildLogo')}</p>
                        <p className="type-caption text-hint">{t('guildLogoHint')}</p>
                        {logoError && (
                          <p role="alert" className="type-caption text-danger">{logoError}</p>
                        )}
                      </div>
                      {canEditGuild && (
                        <div className="flex shrink-0 gap-2">
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
                              if (file) void uploadLogo(file);
                            }}
                          />
                          {guild?.icon && (
                            <Button
                              size="sm"
                              variant="ghost"
                              isPending={isRemovingLogo}
                              isDisabled={isUploadingLogo}
                              onPress={removeLogo}
                            >
                              {t('removeLogo')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            isPending={isUploadingLogo}
                            isDisabled={!guild || isRemovingLogo}
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
                      {isEditingName ? (
                        <form
                          className="flex flex-1 flex-wrap items-end gap-2"
                          onSubmit={event => {
                            event.preventDefault();
                            saveGuildName();
                          }}
                        >
                          <TextField className="flex-1 min-w-48" isRequired>
                            <Label>{t('guildName')}</Label>
                            <Input
                              variant="secondary"
                              value={guildNameDraft}
                              onChange={event => setGuildNameDraft(event.target.value)}
                              autoFocus
                            />
                          </TextField>
                          <Button size="sm" variant="secondary" onPress={() => setIsEditingName(false)}>
                            {t('cancel')}
                          </Button>
                          <Button size="sm" type="submit" isPending={isSavingName} isDisabled={!guildNameDraft.trim()}>
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
                            <Button size="sm" variant="secondary" isDisabled={!guild} onPress={startEditingName}>
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

              <Card className="border border-divider shadow-none bg-surface">
                <Card.Header>
                  <div className="flex items-center gap-2">
                    <Icon icon="solar:history-linear" width={18} className="text-hint" aria-hidden />
                    <h2 className="type-subheading text-foreground">{t('recentActivity')}</h2>
                  </div>
                </Card.Header>
                <Card.Content className="pt-0">
                  {activityStatus === 'loading' ? (
                    <div className="flex items-center justify-center py-10">
                      <Spinner aria-label={t('loadingActivity')} />
                    </div>
                  ) : activityStatus === 'error' ? (
                    <div role="alert" className="flex flex-col items-center justify-center gap-3 py-10">
                      <Icon icon="solar:danger-circle-linear" width={32} className="text-danger" aria-hidden />
                      <p className="type-body text-subtle">{t('activityLoadError')}</p>
                      <Button size="sm" variant="secondary" onPress={retryActivity}>
                        <Icon icon="solar:restart-linear" width={16} aria-hidden />
                        {t('retry')}
                      </Button>
                    </div>
                  ) : recentActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                      <Icon icon="solar:history-linear" width={32} className="text-disabled" aria-hidden />
                      <p className="type-body text-subtle">{t('noActivity')}</p>
                    </div>
                  ) : (
                    <ul>
                      {recentActivity.map((item, i) => (
                        <li key={item.id}>
                          <div className="flex items-start gap-3 py-3">
                            <div className={`mt-0.5 shrink-0 ${getActivityColor(item.actionType)}`}>
                              <Icon icon={getActivityIcon(item.actionType)} width={18} aria-hidden />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="type-body text-foreground">
                                <span className="font-medium">{item.actor}</span>{' '}
                                <span className="text-subtle">{item.action}</span>
                              </p>
                              <p className="type-caption text-hint mt-0.5">
                                <time dateTime={item.timestamp}>
                                  {formatRelative(new Date(item.timestamp), intlLocale)}
                                </time>
                              </p>
                            </div>
                          </div>
                          {i < recentActivity.length - 1 && <Separator />}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card.Content>
              </Card>
            </div>
          </div>
        </Tabs.Panel>

        {/* Announcements Panel */}
        <Tabs.Panel id="announcements" className="pt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap justify-end items-center gap-3">
              {createDraftFailed && (
                <p role="alert" className="type-caption text-danger">{t('createDraftFailed')}</p>
              )}
              <Button variant="primary" size="sm" onPress={handlePostAnnouncement} isPending={isCreatingDraft}>
                <Icon icon="solar:add-circle-linear" width={16} />
                {t('postAnnouncement')}
              </Button>
            </div>

            <AsyncContent state={announcementsState.state} onRetry={reload} skeleton={<ListSkeleton rows={3} />}>
            {announcements.length === 0 && (
              <Card className="border border-divider shadow-none bg-surface">
                <Card.Content className="p-6 text-center">
                  <p className="type-body text-disabled">{t('noAnnouncements')}</p>
                </Card.Content>
              </Card>
            )}

            <div className="space-y-3">
              {announcements.map(ann => ann.status === 'draft' ? (
                <Card key={ann.id} className="border border-dashed border-divider shadow-none bg-surface">
                  <Card.Content className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <Chip size="sm" variant="secondary" color="warning">{t('draft')}</Chip>
                          <h4 className={`type-subheading truncate ${ann.title.trim() ? 'text-foreground' : 'text-hint'}`}>
                            {ann.title.trim() || t('untitledDraft')}
                          </h4>
                        </div>
                        {ann.content.trim() && (
                          <DiscordMarkdown content={ann.content} className="type-body text-subtle" />
                        )}
                        <p className="type-caption text-hint mt-2">
                          {t('lastSaved', { time: formatRelative(new Date(ann.updatedAt), intlLocale) })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => router.push(`/dashboard/admin/announcements/${ann.id}`)}
                        >
                          <Icon icon="solar:pen-linear" width={16} />
                          {t('editDraft')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          isIconOnly
                          aria-label={t('deleteDraft')}
                          onPress={() => setDraftToDelete(ann)}
                        >
                          <Icon icon="solar:trash-bin-trash-linear" width={16} className="text-danger" />
                        </Button>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              ) : (
                <Card key={ann.id} className="border border-divider shadow-none bg-surface">
                  <Card.Content className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.pinned && (
                            <Icon icon="solar:pin-bold" width={14} className="text-warning" />
                          )}
                          <h4 className="type-subheading text-foreground">{ann.title}</h4>
                        </div>
                        <DiscordMarkdown content={ann.content} className="type-body text-subtle" />
                        <div className="flex items-center gap-2 mt-2">
                          <p className="type-caption text-hint">
                            {t('by')} {ann.author}
                          </p>
                          <span className="type-caption text-disabled">·</span>
                          <p className="type-caption text-hint">
                            {formatRelative(new Date(ann.publishedAt ?? ann.createdAt), intlLocale)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {ann.pinned && (
                          <Chip size="sm" variant="secondary">
                            {t('pinned')}
                          </Chip>
                        )}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => router.push(`/dashboard/admin/announcements/${ann.id}`)}
                          >
                            <Icon icon="solar:pen-linear" width={16} />
                            {t('editDraft')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            isIconOnly
                            aria-label={t('unpublish')}
                            onPress={() => setToUnpublish(ann)}
                          >
                            <Icon icon="solar:undo-left-linear" width={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
            </AsyncContent>
          </div>

          <ConfirmDialog
            heading={t('deleteDraftTitle')}
            body={t('deleteDraftBody', { title: draftToDelete?.title.trim() || t('untitledDraft') })}
            confirmLabel={t('delete')}
            failedMessage={t('deleteDraftFailed')}
            isOpen={draftToDelete !== null}
            onOpenChange={open => { if (!open) setDraftToDelete(null); }}
            onConfirm={() => (draftToDelete ? deleteDraft(draftToDelete) : undefined)}
          />
          <ConfirmDialog
            heading={t('unpublishTitle')}
            body={t('unpublishBody', { title: toUnpublish?.title ?? '' })}
            confirmLabel={t('unpublish')}
            failedMessage={t('unpublishFailed')}
            status="warning"
            isOpen={toUnpublish !== null}
            onOpenChange={open => { if (!open) setToUnpublish(null); }}
            onConfirm={() => (toUnpublish ? unpublish(toUnpublish) : undefined)}
          />
        </Tabs.Panel>

        <Tabs.Panel id="bankRequests" className="pt-4">
          <BankRequestReview guildId={guildId} focusRequestId={focusRequestId} />
        </Tabs.Panel>

        <Tabs.Panel id="templates" className="pt-4">
          <TemplateSettings guildId={guildId} />
        </Tabs.Panel>
      </Tabs>

    </div>
  );
}
