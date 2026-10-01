'use client';

import { Button, Chip, Dropdown, Header, Label, type Selection } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { DEMO_ROLE_ICONS } from '@/components/demo/role-icons';
import { readDemoRole, saveDemoRole } from '@/lib/demo/role';
import { DEV_MOCK_ROLES, type DevMockRole } from '@/lib/dev-mock';

export default function DemoMenu() {
  const t = useTranslations('demo');
  const roles = useTranslations('adminPage.roles');
  const [current] = React.useState(() => readDemoRole());

  const switchRole = (keys: Selection) => {
    const [role] = keys === 'all' ? [] : [...keys];
    if (role === undefined || role === current) return;
    saveDemoRole(role as DevMockRole);
    window.location.reload();
  };

  return (
    <Dropdown>
      <Button size="sm" variant="ghost" aria-label={t('menuLabel')} className="h-11 min-w-11 px-1 sm:h-7 sm:min-w-7">
        <Chip size="sm" color="accent" variant="soft" className="pointer-events-none gap-1">
          <Icon icon="solar:test-tube-linear" width={14} aria-hidden />
          {t('badge')}
        </Chip>
      </Button>
      <Dropdown.Popover className="min-w-56">
        <Dropdown.Menu
          aria-label={t('switchRole')}
          selectionMode="single"
          selectedKeys={current ? [current] : []}
          onSelectionChange={switchRole}
        >
          <Dropdown.Section>
            <Header>{t('switchRole')}</Header>
            {DEV_MOCK_ROLES.map(role => (
              <Dropdown.Item key={role} id={role} textValue={roles(role)}>
                <Icon icon={DEMO_ROLE_ICONS[role]} width={16} aria-hidden />
                <Label>{roles(role)}</Label>
                <Dropdown.ItemIndicator />
              </Dropdown.Item>
            ))}
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
