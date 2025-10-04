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
  Switch,
} from '@heroui/react';
import {
  HomeIcon,
  UsersIcon,
  CalendarIcon,
  CogIcon,
  SunIcon,
  MoonIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth/auth-context';
import { Logo } from './Logo';

// Navigation item interface
interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: string[];
  roles?: string[];
}

// Main navigation items
const navigationItems: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
  },
  {
    key: 'guilds',
    label: 'Guilds',
    href: '/guilds',
    icon: UsersIcon,
  },
  {
    key: 'events',
    label: 'Events',
    href: '/events',
    icon: CalendarIcon,
    permissions: ['events.read'],
  },
  {
    key: 'admin',
    label: 'Administration',
    href: '/admin',
    icon: CogIcon,
    roles: ['admin'],
  },
];

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout, hasPermission, hasRole, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const t = useTranslations();

  // Filter navigation items based on permissions
  const filteredNavItems = navigationItems.filter(item => {
    if (!isAuthenticated) return false;
    
    if (item.permissions) {
      return item.permissions.some(permission => hasPermission(permission));
    }
    
    if (item.roles) {
      return item.roles.some(role => hasRole(role));
    }
    
    return true;
  });

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Navbar 
      isMenuOpen={isMenuOpen} 
      onMenuOpenChange={setIsMenuOpen}
      className="border-b border-divider"
      maxWidth="full"
    >
      {/* Brand */}
      <NavbarContent className="sm:hidden" justify="start">
        <NavbarMenuToggle
          aria-label={isMenuOpen ? "Close menu" : "Open menu"}
          icon={<Bars3Icon className="w-6 h-6" />}
        />
      </NavbarContent>

      <NavbarContent className="sm:hidden pr-3" justify="center">
        <NavbarBrand>
          <Link href="/dashboard" className="flex items-center">
            <Logo size="sm" clickable />
          </Link>
        </NavbarBrand>
      </NavbarContent>

      {/* Desktop Navigation */}
      <NavbarContent className="hidden sm:flex gap-4" justify="start">
        <NavbarBrand>
          <Link href="/dashboard" className="flex items-center">
            <Logo size="sm" clickable priority />
          </Link>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-4" justify="center">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <NavbarItem key={item.key} isActive={isActive}>
              <Link
                href={item.href}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>

      {/* User Menu */}
      <NavbarContent className="flex gap-2" justify="end">
        {/* Theme Toggle */}
        <NavbarItem>
          <Button
            isIconOnly
            variant="ghost"
            onPress={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <SunIcon className="w-5 h-5" />
            ) : (
              <MoonIcon className="w-5 h-5" />
            )}
          </Button>
        </NavbarItem>

        {/* User Dropdown */}
        <NavbarItem>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar
                as="button"
                className="transition-transform"
                size="sm"
                src={user?.avatar}
                name={user?.username}
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="profile" className="h-14 gap-2">
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold">{user?.email}</p>
              </DropdownItem>
              <DropdownItem key="settings">
                <Link href="/settings" className="w-full">
                  Settings
                </Link>
              </DropdownItem>
              <DropdownItem key="help">
                <Link href="/help" className="w-full">
                  Help & Feedback
                </Link>
              </DropdownItem>
              <DropdownItem key="logout" color="danger" onPress={handleLogout}>
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarItem>
      </NavbarContent>

      {/* Mobile Menu */}
      <NavbarMenu>
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          
          return (
            <NavbarMenuItem key={item.key}>
              <Link
                href={item.href}
                className={`flex items-center space-x-3 w-full py-3 px-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-default-100'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            </NavbarMenuItem>
          );
        })}
      </NavbarMenu>
    </Navbar>
  );
}