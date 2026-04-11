'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button, Dropdown, Avatar, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Logo } from './Logo';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
  roles?: string[];
}

const navigationItems: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'solar:home-2-linear',
  },
  {
    key: 'guilds',
    label: 'Guilds',
    href: '/guilds',
    icon: 'solar:users-group-rounded-linear',
  },
  {
    key: 'events',
    label: 'Events',
    href: '/events',
    icon: 'solar:calendar-linear',
    permissions: ['events.read'],
  },
  {
    key: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: 'solar:settings-linear',
    roles: ['admin'],
  },
];

export function Navigation() {
  const t = useTranslations('navigation');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();

  return (
    <header className="border-b border-divider bg-background sticky top-0 z-50">
      <div className="max-w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Mobile toggle */}
        <div className="sm:hidden flex items-center gap-2">
          <button
            aria-label={isMenuOpen ? t('closeMenu') : t('openMenu')}
            className="p-2 rounded-lg text-foreground/50 hover:bg-surface-secondary"
            onClick={() => setIsMenuOpen(prev => !prev)}
          >
            <Icon icon="solar:hamburger-menu-outline" width={20} />
          </button>
        </div>

        {/* Logo — mobile center */}
        <div className="sm:hidden absolute left-1/2 -translate-x-1/2">
          <Link href={navigationItems[0].href}>
            <Logo size="sm" clickable />
          </Link>
        </div>

        {/* Desktop: logo + nav */}
        <div className="hidden sm:flex items-center gap-6">
          <Link href={navigationItems[0].href}>
            <Logo size="sm" clickable priority />
          </Link>
          <nav className="flex items-center gap-1">
            {navigationItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/50 hover:text-foreground hover:bg-surface-secondary'
                  }`}
                >
                  <Icon icon={item.icon} width={16} />
                  <span>{t(item.key as any)}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1">
          <Button
            isIconOnly
            variant="ghost"
            className="text-foreground/50"
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t('toggleTheme')}
          >
            <Icon icon={theme === 'dark' ? 'solar:sun-linear' : 'solar:moon-linear'} width={18} />
          </Button>

          <Dropdown>
            <button className="transition-transform">
              <Avatar size="sm">
                <Avatar.Fallback>U</Avatar.Fallback>
              </Avatar>
            </button>
            <Dropdown.Popover>
              <Dropdown.Menu aria-label="Profile Actions">
                <Dropdown.Item id="settings" textValue={t('settings')}>
                  <Link href="/settings" className="w-full block">
                    <Label>{t('settings')}</Label>
                  </Link>
                </Dropdown.Item>
                <Dropdown.Item id="help" textValue={t('helpFeedback')}>
                  <Link href="/help" className="w-full block">
                    <Label>{t('helpFeedback')}</Label>
                  </Link>
                </Dropdown.Item>
                <Dropdown.Item id="logout" variant="danger" textValue={t('logOut')}>
                  <Link href="/login" className="w-full block">
                    <Label>{t('logOut')}</Label>
                  </Link>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <nav className="sm:hidden bg-background border-t border-divider pt-4 pb-2 px-4 space-y-1">
          {navigationItems.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 w-full py-2.5 px-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/50 hover:text-foreground hover:bg-surface-secondary'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon icon={item.icon} width={18} />
                <span>{t(item.key as any)}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
