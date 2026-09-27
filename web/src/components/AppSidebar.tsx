'use client';

import { Kbd, Skeleton, Tooltip, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { Link as AriaLink } from 'react-aria-components';
import { GuildAvatar } from '@/components/GuildAvatar';
import {
  NAV_SECTIONS,
  isLinkActive,
  isNavGroup,
  type NavGroup,
  type NavLink,
} from '@/lib/dashboard-nav';
import { useGuildPermissions } from '@/lib/permissions';
import { useCurrentGuild } from '@/lib/store';

interface AppSidebarProps {
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export function ShortcutKeys({ keys }: { keys: string[] }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map(key => (
        <Kbd key={key}>
          <Kbd.Content>{key}</Kbd.Content>
        </Kbd>
      ))}
    </span>
  );
}

function WorkspaceIdentity({ isCollapsed }: { isCollapsed: boolean }) {
  const t = useTranslations('dashboardLayout');
  const { guild, status } = useCurrentGuild();
  const isLoading = status !== 'ready';
  const name = guild?.name || t('sunbaby');

  return (
    <div className={cn('flex h-10 min-w-0 items-center gap-2 px-1.5', isCollapsed ? 'w-10' : 'w-full')}>
      <GuildAvatar name={name} src={guild?.icon} isLoading={isLoading} />
      {!isCollapsed &&
        (isLoading ? (
          <Skeleton className="h-4 w-24 rounded-lg" />
        ) : (
          <span className="type-body min-w-0 flex-1 truncate font-medium text-foreground" title={name}>
            {name}
          </span>
        ))}
    </div>
  );
}

function NavItemLink({
  item,
  isActive,
  isCollapsed,
  isNested = false,
  onNavigate,
}: {
  item: NavLink;
  isActive: boolean;
  isCollapsed: boolean;
  isNested?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('dashboardLayout');
  const label = t(item.label);

  const link = (
    <AriaLink
      href={item.href}
      aria-label={isCollapsed ? label : undefined}
      aria-current={isActive ? 'page' : undefined}
      onPress={onNavigate}
      className={({ isFocusVisible }) =>
        cn(
          'group flex h-8 items-center gap-2.5 rounded-lg px-[11px] type-body font-medium outline-none transition-colors',
          isCollapsed ? 'w-10' : 'w-full',
          isNested && !isCollapsed && 'pl-[39px]',
          isActive ? 'bg-default text-foreground' : 'text-subtle hover:bg-default/60 hover:text-foreground',
          isFocusVisible && 'ring-2 ring-focus',
        ) ?? ''
      }
    >
      {!isNested && (
        <Icon
          icon={item.icon}
          width={18}
          aria-hidden
          className={cn('shrink-0', isActive ? 'text-foreground' : 'text-hint group-hover:text-subtle')}
        />
      )}
      {!isCollapsed && <span className="truncate">{label}</span>}
    </AriaLink>
  );

  if (!isCollapsed) return link;

  return (
    <Tooltip delay={0}>
      {link}
      <Tooltip.Content placement="right" className="flex items-center gap-2">
        <span>{label}</span>
        {item.shortcut && <ShortcutKeys keys={['G', item.shortcut.toUpperCase()]} />}
      </Tooltip.Content>
    </Tooltip>
  );
}

function NavGroupItem({
  group,
  isCollapsed,
  pathname,
  tab,
  onNavigate,
}: {
  group: NavGroup;
  isCollapsed: boolean;
  pathname: string;
  tab: string | null;
  onNavigate?: () => void;
}) {
  const t = useTranslations('dashboardLayout');
  const isInside = isLinkActive(group.href, pathname, tab);
  const [isExpanded, setIsExpanded] = React.useState(isInside);
  const [wasInside, setWasInside] = React.useState(isInside);
  const panelId = React.useId();

  if (isInside !== wasInside) {
    setWasInside(isInside);
    if (isInside) setIsExpanded(true);
  }

  if (isCollapsed) {
    return <NavItemLink item={group} isActive={isInside} isCollapsed onNavigate={onNavigate} />;
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => setIsExpanded(value => !value)}
        className={cn(
          'group flex h-8 w-full items-center gap-2.5 rounded-lg pl-[11px] pr-2 type-body font-medium outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-focus',
          isInside && !isExpanded ? 'bg-default text-foreground' : 'text-subtle hover:bg-default/60 hover:text-foreground',
        )}
      >
        <Icon
          icon={group.icon}
          width={18}
          aria-hidden
          className={cn('shrink-0', isInside ? 'text-foreground' : 'text-hint group-hover:text-subtle')}
        />
        <span className="flex-1 truncate text-left">{t(group.label)}</span>
        <Icon
          icon="solar:alt-arrow-right-linear"
          width={14}
          aria-hidden
          className={cn('shrink-0 text-hint transition-transform', isExpanded && 'rotate-90')}
        />
      </button>
      {isExpanded && (
        <ul id={panelId} className="mt-0.5 space-y-0.5">
          {group.children.map(child => (
            <li key={child.key}>
              <NavItemLink
                item={child}
                isNested
                isCollapsed={false}
                isActive={isLinkActive(child.href, pathname, tab)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AppSidebar({ isCollapsed, onNavigate }: AppSidebarProps) {
  const t = useTranslations('dashboardLayout');
  const pathname = usePathname();
  const { can } = useGuildPermissions();
  const sections = NAV_SECTIONS.filter(section => section.key !== 'admin' || can('accessAdmin'));
  const tab = useSearchParams().get('tab');

  return (
    <div
      className={cn(
        'flex h-full flex-col bg-surface px-2 py-3 transition-[width] duration-200',
        isCollapsed ? 'w-14' : 'w-60',
      )}
    >
      <WorkspaceIdentity isCollapsed={isCollapsed} />

      <nav aria-label={t('navigation')} className="-mx-2 mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-1">
        {sections.map(section => (
          <div key={section.key} className="flex flex-col">
            {section.label && (
              <p
                aria-hidden={isCollapsed || undefined}
                className={cn(
                  'type-label truncate px-[11px] pb-1 text-hint transition-opacity duration-200',
                  isCollapsed && 'select-none opacity-0',
                )}
              >
                {t(`sections.${section.label}`)}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map(item => (
                <li key={item.key}>
                  {isNavGroup(item) ? (
                    <NavGroupItem
                      group={item}
                      isCollapsed={isCollapsed}
                      pathname={pathname}
                      tab={tab}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <NavItemLink
                      item={item}
                      isCollapsed={isCollapsed}
                      isActive={isLinkActive(item.href, pathname, tab)}
                      onNavigate={onNavigate}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
