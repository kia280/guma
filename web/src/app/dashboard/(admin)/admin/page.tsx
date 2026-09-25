'use client';

import React from 'react';
import Link from 'next/link';
import {
  Tabs,
  Card,
  Table,
  Chip,
  Avatar,
  Button,
  Input,
  Separator,
  TextField,
  Label,
  Spinner,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';

import { BankRequestReview } from '@/components/BankRequestReview';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DiscordMarkdown } from '@/components/DiscordMarkdown';
import { useLiveResource } from '@/hooks/useLiveResource';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import { HTML_LANG, isLocale } from '@/i18n/locales';
import type { MockUser } from '@/types/user';
import type { AdminActivity, AdminAnnouncement } from '@/types/admin';
import type { Guild } from '@/types/guild';

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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'online':
      return 'success';
    case 'offline':
      return 'default';
    case 'banned':
      return 'danger';
    default:
      return 'default';
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'owner':
      return 'accent';
    case 'admin':
      return 'danger';
    case 'moderator':
      return 'warning';
    case 'member':
      return 'default';
    default:
      return 'default';
  }
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
      return 'text-secondary';
    default:
      return 'text-hint';
  }
};

export default function AdminPage() {
  const t = useTranslations('adminPage');
  const locale = useLocale();
  const router = useRouter();
  const tabParam = useSearchParams().get('tab') ?? undefined;
  const initialTab = tabParam === 'activity' ? 'guild' : tabParam;
  const intlLocale = isLocale(locale) ? HTML_LANG[locale] : locale;
  const formatLastActive = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(date.getTime())
      ? formatRelative(date, intlLocale)
      : value;
  };
  const guildId = useCurrentGuildId();

  const [mockUsers, setMockUsers] = React.useState<MockUser[]>([]);
  const [recentActivity, setRecentActivity] = React.useState<AdminActivity[]>([]);
  const [activityStatus, setActivityStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [activityReloadKey, setActivityReloadKey] = React.useState(0);
  const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([]);
  const [guild, setGuild] = React.useState<Guild | null>(null);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [guildNameDraft, setGuildNameDraft] = React.useState('');
  const [isSavingName, setIsSavingName] = React.useState(false);

  const startEditingName = () => {
    setGuildNameDraft(guild?.name ?? '');
    setIsEditingName(true);
  };

  const saveGuildName = async () => {
    const name = guildNameDraft.trim();
    if (!guild || !name) return;
    setIsSavingName(true);
    try {
      setGuild(await apiClient.updateGuild(guild.id, { name }));
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update guild name', err);
    } finally {
      setIsSavingName(false);
    }
  };

  React.useEffect(() => {
    let cancelled = false;
    apiClient.listMembers(guildId).then(d => { if (!cancelled) setMockUsers(d); }).catch(() => {});
    apiClient.getAdminAnnouncements(guildId).then(d => { if (!cancelled) setAnnouncements(d); }).catch(() => {});
    apiClient.getCurrentGuild().then(d => { if (!cancelled) setGuild(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [guildId]);

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

  const refetchAnnouncements = React.useCallback(() => {
    apiClient.getAdminAnnouncements(guildId).then(setAnnouncements).catch(() => {});
  }, [guildId]);

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
    } catch (err) {
      console.error('Failed to create announcement draft', err);
      setCreateDraftFailed(true);
      setIsCreatingDraft(false);
    }
  };

  const deleteDraft = async (draft: AdminAnnouncement) => {
    await apiClient.deleteAnnouncementDraft(guildId, draft.id);
    setAnnouncements(prev => prev.filter(a => a.id !== draft.id));
  };

  const unpublish = async (ann: AdminAnnouncement) => {
    await apiClient.unpublishAnnouncement(guildId, ann.id);
    refetchAnnouncements();
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Link
          href="/dashboard/admin/roles"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 type-body text-accent transition-colors hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <Icon icon="solar:shield-check-linear" width={16} aria-hidden />
          {t('rolePermissions')}
        </Link>
      </div>
      <Tabs aria-label="Admin sections" defaultSelectedKey={initialTab}>
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
              <Table>
                <Table.ScrollContainer>
                  <Table.Content aria-label="Users table">
                    <Table.Header>
                      <Table.Column isRowHeader>{t('user')}</Table.Column>
                      <Table.Column>{t('role')}</Table.Column>
                      <Table.Column className="hidden md:table-cell">{t('status')}</Table.Column>
                      <Table.Column className="hidden md:table-cell">{t('lastActive')}</Table.Column>
                    </Table.Header>
                    <Table.Body>
                      {mockUsers.map(user => (
                        <Table.Row key={user.id}>
                          <Table.Cell>
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar size="sm" className="shrink-0">
                                <Avatar.Image src={user.avatar} />
                                <Avatar.Fallback>
                                  {user.username.slice(0, 2).toUpperCase()}
                                </Avatar.Fallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="type-body font-medium text-foreground truncate">
                                  {user.username}
                                </p>
                                <p className="type-caption text-hint truncate hidden sm:block">{user.email}</p>
                              </div>
                            </div>
                          </Table.Cell>
                          <Table.Cell>
                            <Chip size="sm" color={getRoleColor(user.role ?? '')} variant="secondary" className="capitalize">
                              {user.role && ROLES.includes(user.role as (typeof ROLES)[number])
                                ? t(`roles.${user.role as (typeof ROLES)[number]}`)
                                : user.role}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <Chip size="sm" variant="secondary" className="capitalize">
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
            </Card.Content>
          </Card>
        </Tabs.Panel>

        {/* Guild Panel */}
        <Tabs.Panel id="guild" className="pt-4">
          <div className="space-y-4">
            {/* Overview stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: t('totalMembers'),
                  value: '24',
                  icon: 'solar:users-group-rounded-linear',
                  color: 'text-accent',
                  bg: 'bg-accent/10',
                },
                {
                  label: t('guildBalance'),
                  value: '$12,500',
                  icon: 'solar:wallet-money-linear',
                  color: 'text-success',
                  bg: 'bg-success/10',
                },
                {
                  label: t('activeEvents'),
                  value: '3',
                  icon: 'solar:calendar-linear',
                  color: 'text-warning',
                  bg: 'bg-warning/10',
                },
                {
                  label: t('totalItems'),
                  value: '47',
                  icon: 'solar:backpack-linear',
                  color: 'text-secondary',
                  bg: 'bg-secondary/10',
                },
              ].map(stat => (
                <Card key={stat.label} className="border border-divider shadow-none bg-surface">
                  <Card.Content className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`${stat.bg} p-2 rounded-lg`}>
                        <Icon icon={stat.icon} width={18} className={stat.color} />
                      </div>
                      <div>
                        <p className="type-caption text-hint">{stat.label}</p>
                        <p className="type-title tabular-nums text-foreground">{stat.value}</p>
                      </div>
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>

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
                          <Button size="sm" variant="secondary" isDisabled={!guild} onPress={startEditingName}>
                            {t('edit')}
                          </Button>
                        </>
                      )}
                    </div>
                    {[
                      { label: t('recruitment'), value: 'Open' },
                      { label: t('serverRegion'), value: 'Asia Pacific' },
                    ].map(setting => (
                      <div key={setting.label} className="py-2">
                        <p className="type-body text-subtle">{setting.label}</p>
                        <p className="type-body font-medium text-foreground">{setting.value}</p>
                      </div>
                    ))}
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
          <BankRequestReview guildId={guildId} />
        </Tabs.Panel>
      </Tabs>

    </div>
  );
}
