'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
} from '@heroui/react';
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
    <Navbar
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      classNames={{
        base: 'border-b border-divider bg-background',
        wrapper: 'max-w-full px-4 sm:px-6',
      }}
    >
      {/* Mobile */}
      <NavbarContent className="sm:hidden" justify="start">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? t('closeMenu') : t('openMenu')}
          icon={
            <Icon icon="solar:hamburger-menu-outline" width={20} className="text-default-500" />
          }
        />
      </NavbarContent>

      <NavbarContent className="sm:hidden pr-3" justify="center">
        <NavbarBrand>
          <Link href={navigationItems[0].href} className="flex items-center">
            <Logo size="sm" clickable />
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop */}
      <NavbarContent className="hidden sm:flex gap-4" justify="start">
        <NavbarBrand>
          <Link href={navigationItems[0].href} className="flex items-center">
            <Logo size="sm" clickable priority />
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-1" justify="center">
        {navigationItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <NavbarItem key={item.key}>
              <Link
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-default-500 hover:text-foreground hover:bg-content2'
                }`}
              >
                <Icon icon={item.icon} width={16} />
                <span>{t(item.key as any)}</span>
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      {/* Right */}
      <NavbarContent className="flex gap-1" justify="end">
        <NavbarItem>
          <Button
            isIconOnly
            variant="light"
            className="text-default-500"
            onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={t('toggleTheme')}
          >
            <Icon icon={theme === 'dark' ? 'solar:sun-linear' : 'solar:moon-linear'} width={18} />
          </Button>
        </NavbarItem>

        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar as="button" className="transition-transform" size="sm" />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="settings">
                <Link href="/settings" className="w-full">
                  {t('settings')}
                </Link>
              </DropdownItem>
              <DropdownItem key="help">
                <Link href="/help" className="w-full">
                  {t('helpFeedback')}
                </Link>
              </DropdownItem>
              <DropdownItem key="logout" color="danger">
                <Link href="/login" className="w-full">
                  {t('logOut')}
                </Link>
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu className="bg-background border-t border-divider pt-4">
        {navigationItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <NavbarMenuItem key={item.key}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 w-full py-2.5 px-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-default-500 hover:text-foreground hover:bg-content2'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon icon={item.icon} width={18} />
                <span>{t(item.key as any)}</span>
              </Link>
            </NavbarMenuItem>
          );
        })}
      </NavbarMenu>
    </Navbar>
  );
}
