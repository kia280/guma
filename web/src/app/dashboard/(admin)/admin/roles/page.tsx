'use client';

import { Button, Card, Chip, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/PageHeader';
import {
  GUILD_ROLES as ROLES,
  PERMISSION_SECTIONS as SECTIONS,
  ROLE_CHIP_COLORS as ROLE_COLORS,
  type GuildRole as Role,
} from '@/lib/permissions';

export default function AdminRolesPage() {
  const t = useTranslations('adminRolesPage');
  const tRoles = useTranslations('adminPage.roles');
  const router = useRouter();
  const actionNote = (key: string) => (key === 'leaveGuild' ? t('ownerLeaveNote') : null);

  return (
    <div className="space-y-5">
      <div className="flex">
        <Button variant="secondary" onPress={() => router.push('/dashboard/admin')}>
          <Icon icon="solar:arrow-left-line-duotone" width={16} />
          {t('back')}
        </Button>
      </div>

      <PageHeader title={t('title')} description={t('subtitle')} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map(role => (
          <li key={role}>
            <Card className="h-full border border-divider shadow-none bg-surface">
              <Card.Content className="gap-2 type-body">
                <Chip
                  size="sm"
                  color={ROLE_COLORS[role]}
                  variant="secondary"
                  className="self-start"
                >
                  {tRoles(role)}
                </Chip>
                <p className="text-subtle">{t(`roleSummaries.${role}`)}</p>
              </Card.Content>
            </Card>
          </li>
        ))}
      </ul>

      <p className="type-caption text-hint sm:hidden">{t('mobileLegend')}</p>

      {SECTIONS.map(section => (
        <Card key={section.key} className="border border-divider shadow-none bg-surface">
          <Card.Header className="flex flex-row items-center gap-3 pb-2">
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
            <ul
              aria-labelledby={`roles-section-${section.key}`}
              className="flex flex-col gap-2 sm:hidden"
            >
              {section.actions.map(action => (
                <li
                  key={action.key}
                  className="flex flex-col gap-2 rounded-lg bg-surface-secondary px-3 py-2.5 type-body"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground">{t(`actions.${action.key}`)}</span>
                    {actionNote(action.key) && (
                      <span className="type-caption text-hint">{actionNote(action.key)}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(action.roles as readonly Role[]).map(role => (
                      <Chip key={role} size="sm" color={ROLE_COLORS[role]} variant="secondary">
                        {tRoles(role)}
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <Table variant="secondary" className="hidden sm:grid">
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
                          {actionNote(action.key) && (
                            <span className="block type-caption text-hint">
                              {actionNote(action.key)}
                            </span>
                          )}
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
                                className={`inline-block ${allowed ? 'text-success' : 'text-hint'}`}
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
    </div>
  );
}
