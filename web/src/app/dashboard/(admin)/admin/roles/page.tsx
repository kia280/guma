'use client';

import { Card, Chip, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/PageHeader';

const ROLES = ['owner', 'admin', 'moderator', 'member'] as const;
type Role = (typeof ROLES)[number];

const ALL: Role[] = ['owner', 'admin', 'moderator', 'member'];
const OWNER_ADMIN: Role[] = ['owner', 'admin'];
const STAFF: Role[] = ['owner', 'admin', 'moderator'];

const ROLE_COLORS = {
  owner: 'accent',
  admin: 'danger',
  moderator: 'warning',
  member: 'default',
} as const;

const SECTIONS = [
  {
    key: 'guild',
    icon: 'solar:users-group-rounded-bold-duotone',
    actions: [
      { key: 'viewGuild', roles: ALL },
      { key: 'viewMembers', roles: ALL },
      { key: 'editGuild', roles: OWNER_ADMIN },
      { key: 'deleteGuild', roles: ['owner'] as Role[] },
      { key: 'leaveGuild', roles: ['admin', 'moderator', 'member'] as Role[] },
    ],
  },
  {
    key: 'checkin',
    icon: 'solar:clipboard-check-bold-duotone',
    actions: [
      { key: 'attendCheckin', roles: ALL },
      { key: 'createCheckin', roles: STAFF },
    ],
  },
  {
    key: 'bank',
    icon: 'solar:safe-2-bold-duotone',
    actions: [
      { key: 'contribute', roles: ALL },
      { key: 'requestFromBank', roles: ALL },
      { key: 'reviewRequests', roles: STAFF },
    ],
  },
  {
    key: 'auction',
    icon: 'solar:sledgehammer-bold-duotone',
    actions: [
      { key: 'createAuction', roles: ALL },
      { key: 'placeBid', roles: ALL },
      { key: 'cancelAuction', roles: OWNER_ADMIN },
    ],
  },
  {
    key: 'lottery',
    icon: 'solar:ticket-bold-duotone',
    actions: [
      { key: 'buyTickets', roles: ALL },
      { key: 'createLottery', roles: OWNER_ADMIN },
      { key: 'drawLottery', roles: OWNER_ADMIN },
      { key: 'changeDrawDate', roles: OWNER_ADMIN },
    ],
  },
  {
    key: 'wallet',
    icon: 'solar:wallet-money-bold-duotone',
    actions: [{ key: 'manageWallet', roles: ALL }],
  },
] as const;

export default function AdminRolesPage() {
  const t = useTranslations('adminRolesPage');
  const tRoles = useTranslations('adminPage.roles');

  return (
    <div className="space-y-5">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map(role => (
          <li key={role}>
            <Card className="h-full border border-divider shadow-none bg-surface">
              <Card.Content className="gap-2 p-4">
                <Chip
                  size="sm"
                  color={ROLE_COLORS[role]}
                  variant="secondary"
                  className="self-start"
                >
                  {tRoles(role)}
                </Chip>
                <p className="type-body text-subtle">{t(`roleSummaries.${role}`)}</p>
              </Card.Content>
            </Card>
          </li>
        ))}
      </ul>

      {SECTIONS.map(section => (
        <Card key={section.key} className="border border-divider shadow-none bg-surface">
          <Card.Header className="flex gap-3 pb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
              <Icon className="text-accent" icon={section.icon} width={20} aria-hidden />
            </div>
            <div className="flex flex-col">
              <h2 id={`roles-section-${section.key}`} className="type-subheading text-foreground">
                {t(`sections.${section.key}.title`)}
              </h2>
              <p className="type-caption text-hint">{t(`sections.${section.key}.description`)}</p>
            </div>
          </Card.Header>
          <Card.Content className="p-0">
            <Table>
              <Table.ScrollContainer>
                <Table.Content
                  aria-labelledby={`roles-section-${section.key}`}
                  className="min-w-[560px]"
                >
                  <Table.Header>
                    <Table.Column isRowHeader>{t('action')}</Table.Column>
                    {ROLES.map(role => (
                      <Table.Column key={role} className="w-24 text-center">
                        {tRoles(role)}
                      </Table.Column>
                    ))}
                  </Table.Header>
                  <Table.Body>
                    {section.actions.map(action => (
                      <Table.Row key={action.key}>
                        <Table.Cell>
                          <span className="type-body text-foreground">
                            {t(`actions.${action.key}`)}
                          </span>
                        </Table.Cell>
                        {ROLES.map(role => {
                          const allowed = (action.roles as readonly Role[]).includes(role);
                          return (
                            <Table.Cell key={role} className="text-center">
                              <Icon
                                icon={
                                  allowed ? 'solar:check-circle-bold' : 'solar:minus-circle-linear'
                                }
                                width={20}
                                className={`inline-block ${allowed ? 'text-success' : 'text-disabled'}`}
                                aria-hidden
                              />
                              <span className="sr-only">
                                {allowed ? t('allowed') : t('notAllowed')}
                              </span>
                            </Table.Cell>
                          );
                        })}
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </Card.Content>
        </Card>
      ))}

      <p className="type-caption text-hint">{t('ownerLeaveNote')}</p>
    </div>
  );
}
