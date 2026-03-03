'use client';

import React from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  CardHeader,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Avatar,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Switch,
  useDisclosure,
  Divider,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

// Mock data
const mockUsers = [
  {
    id: 'u1',
    username: 'GuildMaster',
    email: 'master@example.com',
    role: 'admin',
    status: 'online',
    lastActive: '2 min ago',
    avatar: undefined,
  },
  {
    id: 'u2',
    username: 'DragonHunter',
    email: 'dragon@example.com',
    role: 'member',
    status: 'offline',
    lastActive: '1h ago',
    avatar: undefined,
  },
  {
    id: 'u3',
    username: 'Healer',
    email: 'healer@example.com',
    role: 'member',
    status: 'online',
    lastActive: 'just now',
    avatar: undefined,
  },
  {
    id: 'u4',
    username: 'Blacksmith',
    email: 'blacksmith@example.com',
    role: 'moderator',
    status: 'offline',
    lastActive: '3h ago',
    avatar: undefined,
  },
  {
    id: 'u5',
    username: 'ShadowRogue',
    email: 'rogue@example.com',
    role: 'member',
    status: 'banned',
    lastActive: '2d ago',
    avatar: undefined,
  },
];

const mockActivity = [
  {
    id: 'a1',
    actor: 'DragonHunter',
    action: 'placed a bid on Dragon Slayer Sword',
    actionType: 'auction',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'a2',
    actor: 'Healer',
    action: 'checked in to weekly guild check-in',
    actionType: 'checkin',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'a3',
    actor: 'Warrior123',
    action: 'purchased 2 lottery tickets',
    actionType: 'lottery',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'a4',
    actor: 'Blacksmith',
    action: 'joined the guild',
    actionType: 'join',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a5',
    actor: 'GuildMaster',
    action: 'created auction for Mystic Shield',
    actionType: 'auction',
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a6',
    actor: 'ScrollMaster',
    action: 'checked in to raid preparation',
    actionType: 'checkin',
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];

const mockAnnouncements = [
  {
    id: 'ann1',
    title: 'Weekly Raid Night - Friday 8PM',
    content:
      'This Friday we will be tackling the Ancient Dragon. All members level 50+ are encouraged to join.',
    pinned: true,
    author: 'GuildMaster',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'ann2',
    title: 'Guild Treasury Update',
    content:
      'The guild treasury has been updated. Auction proceeds for this month have been distributed.',
    pinned: false,
    author: 'GuildMaster',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

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
      return 'solar:hammer-linear';
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
      return 'text-primary';
    case 'join':
      return 'text-secondary';
    default:
      return 'text-default-400';
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
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [announcements, setAnnouncements] = React.useState(mockAnnouncements);
  const [newTitle, setNewTitle] = React.useState('');
  const [newContent, setNewContent] = React.useState('');
  const [isPinned, setIsPinned] = React.useState(false);

  const handlePostAnnouncement = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const newAnn = {
      id: `ann-${Date.now()}`,
      title: newTitle,
      content: newContent,
      pinned: isPinned,
      author: 'GuildMaster',
      createdAt: new Date().toISOString(),
    };
    setAnnouncements(prev => [newAnn, ...prev]);
    setNewTitle('');
    setNewContent('');
    setIsPinned(false);
    onOpenChange();
  };

  return (
    <div className="space-y-5">
      <Tabs aria-label="Admin sections" size="md">
        {/* Users Tab */}
        <Tab
          key="users"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:users-group-rounded-linear" width={16} />
              <span>{t('users')}</span>
              <Chip size="sm" variant="flat">
                {mockUsers.length}
              </Chip>
            </div>
          }
        >
          <Card className="border border-divider shadow-none bg-content1 mt-3">
            <CardBody className="p-0">
              <Table
                aria-label="Users table"
                classNames={{
                  wrapper: 'shadow-none',
                  th: 'bg-content2 text-default-500 text-xs font-medium',
                }}
              >
                <TableHeader>
                  <TableColumn>{t('user')}</TableColumn>
                  <TableColumn>{t('role')}</TableColumn>
                  <TableColumn>{t('status')}</TableColumn>
                  <TableColumn>{t('lastActive')}</TableColumn>
                </TableHeader>
                <TableBody>
                  {mockUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={user.avatar}
                            name={user.username}
                            size="sm"
                            isBordered
                            color={getStatusColor(user.status) as any}
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{user.username}</p>
                            <p className="text-xs text-default-400">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={getRoleColor(user.role) as any}
                          variant="flat"
                          className="capitalize"
                        >
                          {user.role}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="sm"
                          color={getStatusColor(user.status) as any}
                          variant="dot"
                          className="capitalize"
                        >
                          {user.status}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-default-500">{user.lastActive}</p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </Tab>

        {/* Activity Tab */}
        <Tab
          key="activity"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:chart-2-linear" width={16} />
              <span>{t('activity')}</span>
            </div>
          }
        >
          <Card className="border border-divider shadow-none bg-content1 mt-3">
            <CardHeader>
              <p className="text-sm font-medium text-foreground">{t('recentActivity')}</p>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-1">
                {mockActivity.map((item, i) => (
                  <div key={item.id}>
                    <div className="flex items-start gap-3 py-3">
                      <div className={`mt-0.5 shrink-0 ${getActivityColor(item.actionType)}`}>
                        <Icon icon={getActivityIcon(item.actionType)} width={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{item.actor}</span>{' '}
                          <span className="text-default-500">{item.action}</span>
                        </p>
                        <p className="text-xs text-default-400 mt-0.5">
                          {formatTimeAgo(item.timestamp)}
                        </p>
                      </div>
                    </div>
                    {i < mockActivity.length - 1 && <Divider />}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </Tab>

        {/* Guild Tab */}
        <Tab
          key="guild"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:buildings-linear" width={16} />
              <span>{t('guild')}</span>
            </div>
          }
        >
          <div className="mt-3 space-y-4">
            {/* Overview stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: t('totalMembers'),
                  value: '24',
                  icon: 'solar:users-group-rounded-linear',
                  color: 'text-primary',
                  bg: 'bg-primary/10',
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
                <Card key={stat.label} className="border border-divider shadow-none bg-content1">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`${stat.bg} p-2 rounded-lg`}>
                        <Icon icon={stat.icon} width={18} className={stat.color} />
                      </div>
                      <div>
                        <p className="text-xs text-default-400">{stat.label}</p>
                        <p className="text-xl font-semibold text-foreground">{stat.value}</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>

            {/* Guild Settings placeholder */}
            <Card className="border border-divider shadow-none bg-content1">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:settings-linear" width={18} className="text-default-400" />
                  <p className="text-sm font-medium text-foreground">{t('guildSettings')}</p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <div className="space-y-3">
                  {[
                    { label: t('guildName'), value: 'Sunbaby Guild', editable: true },
                    { label: t('guildTag'), value: '[SB]', editable: true },
                    { label: t('recruitment'), value: 'Open', editable: false },
                    { label: t('serverRegion'), value: 'Asia Pacific', editable: false },
                  ].map(setting => (
                    <div key={setting.label} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm text-default-500">{setting.label}</p>
                        <p className="text-sm font-medium text-foreground">{setting.value}</p>
                      </div>
                      {setting.editable && (
                        <Button size="sm" variant="flat">
                          {t('edit')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        {/* Announcements Tab */}
        <Tab
          key="announcements"
          title={
            <div className="flex items-center gap-2">
              <Icon icon="solar:megaphone-linear" width={16} />
              <span>{t('announcements')}</span>
            </div>
          }
        >
          <div className="mt-3 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-default-500">{announcements.length}</p>
              <Button
                color="primary"
                size="sm"
                startContent={<Icon icon="solar:add-circle-linear" width={16} />}
                onPress={onOpen}
              >
                {t('postAnnouncement')}
              </Button>
            </div>

            <div className="space-y-3">
              {announcements.map(ann => (
                <Card key={ann.id} className="border border-divider shadow-none bg-content1">
                  <CardBody className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ann.pinned && (
                            <Icon icon="solar:pin-bold" width={14} className="text-warning" />
                          )}
                          <h4 className="text-sm font-medium text-foreground">{ann.title}</h4>
                        </div>
                        <p className="text-sm text-default-500">{ann.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-xs text-default-400">
                            {t('by')} {ann.author}
                          </p>
                          <span className="text-xs text-default-300">·</span>
                          <p className="text-xs text-default-400">{formatTimeAgo(ann.createdAt)}</p>
                        </div>
                      </div>
                      {ann.pinned && (
                        <Chip size="sm" color="warning" variant="flat">
                          {t('pinned')}
                        </Chip>
                      )}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </Tab>
      </Tabs>

      {/* Post Announcement Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center" size="md">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>{t('postAnnouncement')}</ModalHeader>
              <ModalBody>
                <Input
                  label={t('announcementTitle')}
                  placeholder={t('announcementTitle')}
                  value={newTitle}
                  onValueChange={setNewTitle}
                  variant="bordered"
                />
                <Textarea
                  label={t('announcementContent')}
                  placeholder={t('announcementContent')}
                  value={newContent}
                  onValueChange={setNewContent}
                  variant="bordered"
                  minRows={3}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">{t('pinAnnouncement')}</p>
                    <p className="text-xs text-default-400">{t('pinNote')}</p>
                  </div>
                  <Switch isSelected={isPinned} onValueChange={setIsPinned} size="sm" />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button
                  color="primary"
                  onPress={handlePostAnnouncement}
                  isDisabled={!newTitle.trim() || !newContent.trim()}
                >
                  {t('post')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
