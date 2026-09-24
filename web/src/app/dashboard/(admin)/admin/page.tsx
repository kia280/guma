'use client';

import React from 'react';
import {
  Tabs,
  Card,
  Table,
  Chip,
  Avatar,
  Button,
  Modal,
  Input,
  TextArea,
  Switch,
  Separator,
  TextField,
  Label,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import type { MockUser } from '@/types/user';
import type { AdminActivity, AdminAnnouncement } from '@/types/admin';

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

const formatTimeAgo = (timestamp: string) => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${mins}m ago`;
};

export default function AdminPage() {
  const t = useTranslations('adminPage');
  const guildId = useCurrentGuildId();

  const [mockUsers, setMockUsers] = React.useState<MockUser[]>([]);
  const [mockActivity, setMockActivity] = React.useState<AdminActivity[]>([]);
  const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    apiClient.listMembers(guildId).then(d => { if (!cancelled) setMockUsers(d); }).catch(() => {});
    apiClient.getAdminActivity().then(d => { if (!cancelled) setMockActivity(d); }).catch(() => {});
    apiClient.getAdminAnnouncements().then(d => { if (!cancelled) setAnnouncements(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [guildId]);

  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [isPinned, setIsPinned] = React.useState(false);

  const handlePostAnnouncement = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    try {
      const ann = await apiClient.createAnnouncement({
        title: newTitle,
        content: newContent,
        pinned: isPinned,
      });
      setAnnouncements(prev => [ann, ...prev]);
      setNewTitle('');
      setNewContent('');
      setIsPinned(false);
    } catch (err) {
      console.error('Failed to post announcement', err);
    }
  };

  return (
    <div className="space-y-5">
      <Tabs aria-label="Admin sections">
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
            <Tabs.Tab id="activity">
              <div className="flex items-center gap-2">
                <span>{t('activity')}</span>
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
                <Chip size="sm" variant="secondary">
                  {announcements.length}
                </Chip>
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
                              {user.role}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <Chip size="sm" variant="secondary" className="capitalize">
                              {user.status}
                            </Chip>
                          </Table.Cell>
                          <Table.Cell className="hidden md:table-cell">
                            <p className="type-body text-subtle">{user.lastActive}</p>
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

        {/* Activity Panel */}
        <Tabs.Panel id="activity" className="pt-4">
          <Card className="border border-divider shadow-none bg-surface">
            <Card.Header>
              <p className="type-subheading text-foreground">{t('recentActivity')}</p>
            </Card.Header>
            <Card.Content className="pt-0">
              <div className="space-y-1">
                {mockActivity.map((item, i) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className={`mt-0.5 shrink-0 ${getActivityColor(item.actionType)}`}>
                        <Icon icon={getActivityIcon(item.actionType)} width={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="type-body text-foreground">
                          <span className="font-medium">{item.actor}</span>{' '}
                          <span className="text-subtle">{item.action}</span>
                        </p>
                        <p className="type-caption text-hint mt-0.5">
                          {formatTimeAgo(item.timestamp)}
                        </p>
                      </div>
                    </div>
                    {i < mockActivity.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
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
                  {[
                    { label: t('guildName'), value: 'Sunbaby Guild', editable: true },
                    { label: t('recruitment'), value: 'Open', editable: false },
                    { label: t('serverRegion'), value: 'Asia Pacific', editable: false },
                  ].map(setting => (
                    <div key={setting.label} className="flex items-center justify-between py-2">
                      <div>
                        <p className="type-body text-subtle">{setting.label}</p>
                        <p className="type-body font-medium text-foreground">{setting.value}</p>
                      </div>
                      {setting.editable && (
                        <Button size="sm" variant="secondary">
                          {t('edit')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        {/* Announcements Panel */}
        <Tabs.Panel id="announcements" className="pt-4">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="type-body text-subtle">{announcements.length}</p>
              <Modal>
              <Button variant="primary" size="sm">
                <Icon icon="solar:add-circle-linear" width={16} />
                {t('postAnnouncement')}
              </Button>
              <Modal.Backdrop>
                <Modal.Container size="md">
                  <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header className="text-center items-center">
                      <Modal.Heading>{t('postAnnouncement')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="p-1 flex flex-col gap-3">
                      <TextField>
                        <Label>{t('announcementTitle')}</Label>
                        <Input
                          placeholder={t('announcementTitle')}
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          variant="secondary"
                        />
                      </TextField>
                      <TextField>
                        <Label>{t('announcementContent')}</Label>
                        <TextArea
                          placeholder={t('announcementContent')}
                          value={newContent}
                          onChange={e => setNewContent(e.target.value)}
                          variant="secondary"
                          rows={3}
                        />
                      </TextField>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="type-body text-foreground">{t('pinAnnouncement')}</p>
                          <p className="type-caption text-hint">{t('pinNote')}</p>
                        </div>
                        <Switch isSelected={isPinned} onChange={setIsPinned} size="sm">
                          <Switch.Control>
                            <Switch.Thumb />
                          </Switch.Control>
                        </Switch>
                      </div>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button variant="secondary" slot="close">
                        {t('cancel')}
                      </Button>
                      <Button
                        variant="primary"
                        onPress={handlePostAnnouncement}
                        isDisabled={!newTitle.trim() || !newContent.trim()}
                      >
                        {t('post')}
                      </Button>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
              </Modal>
            </div>

            <div className="space-y-3">
              {announcements.map(ann => (
                <Card key={ann.id} className="border border-divider shadow-none bg-surface">
                  <Card.Content className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.pinned && (
                            <Icon icon="solar:pin-bold" width={14} className="text-warning" />
                          )}
                          <h4 className="type-subheading text-foreground">{ann.title}</h4>
                        </div>
                        <p className="type-body text-subtle">{ann.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="type-caption text-hint">
                            {t('by')} {ann.author}
                          </p>
                          <span className="type-caption text-disabled">·</span>
                          <p className="type-caption text-hint">{formatTimeAgo(ann.createdAt)}</p>
                        </div>
                      </div>
                      {ann.pinned && (
                        <Chip size="sm" variant="secondary">
                          {t('pinned')}
                        </Chip>
                      )}
                    </div>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>

    </div>
  );
}
