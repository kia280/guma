'use client';

import React from 'react';
import {
  Navbar,
  NavbarContent,
  NavbarItem,
  Link,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownSection,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Avatar,
  Tooltip,
  Badge,
  Chip,
  useDisclosure,
} from '@heroui/react';
import { useMediaQuery } from 'usehooks-ts';
import { Icon } from '@iconify/react';
import { useTheme } from 'next-themes';

import { Logo, NotificationsCard, SidebarDrawer, Sidebar } from '@/components';
import { cn } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

interface SidebarItem {
  key: string;
  path: string;
  title: string;
  icon?: string;
  href?: string;
  endContent?: React.ReactNode;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('dashboardLayout');
  const { theme, setTheme } = useTheme();

  const items: SidebarItem[] = [
    {
      key: '',
      path: '',
      icon: 'heroicons:home',
      title: t('dashboard'),
    },
    {
      key: 'checkin',
      path: '/checkin',
      icon: 'heroicons:clipboard-document-check',
      title: t('checkin'),
    },
    {
      key: 'wallet',
      path: '/wallet',
      icon: 'heroicons:wallet',
      title: t('wallet'),
    },
    {
      key: 'guild-bank',
      path: '/guild-bank',
      icon: 'heroicons:building-library',
      title: t('guildBank'),
    },
    {
      key: 'auction',
      path: '/auction',
      icon: 'heroicons:currency-dollar',
      title: t('auction'),
    },
    {
      key: 'lottery',
      path: '/lottery',
      icon: 'heroicons:ticket',
      title: t('lottery'),
    },
    {
      key: 'calendar',
      path: '/calendar',
      icon: 'heroicons:calendar-days',
      title: t('calendar'),
    },
    {
      key: 'admin',
      path: '/admin',
      icon: 'heroicons:cog-6-tooth',
      title: t('admin'),
    },
  ];

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [selectedKey, setSelectedKey] = React.useState('dashboard');
  const router = useRouter();

  const isCompact = useMediaQuery('(max-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 768px)');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.split('/').filter(Boolean)[0] || 'dashboard';
      setSelectedKey(path);
    }
  }, []);

  const onToggle = React.useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Hardcoded balance for navbar display
  const userBalance = 1250.75;

  return (
    <>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <SidebarDrawer
          className={cn('z-50 min-w-[288px]', { 'min-w-[76px] max-w-[76px]': isCollapsed })}
          hideCloseButton={true}
          isOpen={isOpen}
          onOpenChange={onOpenChange}
        >
          <div
            className={cn(
              'will-change bg-content1 border-r border-divider flex h-full flex-col py-[24px] px-[12px]',
              {
                'w-72': !isCollapsed,
                'w-[76px] overflow-hidden': isCollapsed,
              }
            )}
          >
            {/* Sidebar Header — logo + name only, no toggle here */}
            <div className="w-full relative flex items-center p-1 h-[44px]">
              <div className="w-[44px] flex items-center justify-start shrink-0 pl-0.5">
                <Logo size="md" showText={false} className="h-11 w-11" />
              </div>
              {!isCollapsed && (
                <span className="text-small font-bold uppercase text-foreground pl-3">
                  {t('sunbaby')}
                </span>
              )}
            </div>

            <div className="h-[24px]" />

            <Sidebar
              defaultSelectedKey={selectedKey}
              iconClassName="group-data-[selected=true]:text-primary"
              isCompact={isCollapsed}
              itemClasses={{
                base: 'rounded-large data-[selected=true]:bg-primary/10!',
                title: 'group-data-[selected=true]:text-primary',
              }}
              items={items}
              onSelect={key => {
                const item = items.find(i => i.key === key);
                if (item) router.push(`/dashboard${item.path}`);
              }}
            />

            <div className="h-[32px]" />

            {/* Bottom section: toggle */}
            <div className="mt-auto flex items-center justify-center flex-col gap-1 w-full">
              {/* Expand/Collapse toggle */}
              <Button
                fullWidth
                className="text-default-500 data-[hover=true]:text-foreground py-1 px-1 h-[44px] min-h-[44px]"
                variant="light"
                onPress={isMobile ? onOpenChange : onToggle}
              >
                <Tooltip
                  content={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                  isDisabled={!isCollapsed}
                  placement="right"
                >
                  {isCollapsed ? (
                    <div className="flex items-center justify-start">
                      <Icon
                        className="text-default-500"
                        icon="solar:round-alt-arrow-right-line-duotone"
                        width={24}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <div className="flex items-center justify-start">
                        <Icon
                          className="text-default-500"
                          icon="solar:round-alt-arrow-left-line-duotone"
                          width={24}
                        />
                      </div>
                    </div>
                  )}
                </Tooltip>
              </Button>
            </div>
          </div>
        </SidebarDrawer>

        <div className="flex-1 flex flex-col z-0 min-w-0">
          <Navbar
            classNames={{
              base: 'border-b border-divider bg-background',
              item: 'data-[active=true]:text-primary',
              wrapper: 'px-4 sm:px-6 max-w-full no-scrollbar',
            }}
            height="64px"
          >
            <NavbarContent className="h-12 max-w-fit items-center gap-0" justify="start">
              {isCompact && (
                <Button
                  isIconOnly
                  className={cn('text-default-500 flex')}
                  size="sm"
                  variant="light"
                  onPress={onOpen}
                >
                  <Icon height={24} icon="solar:hamburger-menu-outline" width={24} />
                </Button>
              )}
            </NavbarContent>

            {/* Right Menu */}
            <NavbarContent className="ml-auto h-12 max-w-fit items-center gap-1" justify="end">
              {/* Theme toggle */}
              <NavbarItem>
                <Button
                  isIconOnly
                  radius="full"
                  variant="light"
                  className="text-default-500"
                  onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  <Icon
                    icon={theme === 'dark' ? 'solar:sun-linear' : 'solar:moon-linear'}
                    width={20}
                  />
                </Button>
              </NavbarItem>

              {/* Balance chip */}
              <NavbarItem className="hidden sm:flex">
                <Chip
                  startContent={<Icon icon="solar:wallet-linear" width={14} />}
                  variant="flat"
                  color="primary"
                  size="sm"
                  className="cursor-default"
                >
                  ${userBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Chip>
              </NavbarItem>

              {/* Notifications */}
              <NavbarItem className="flex">
                <Popover offset={12} placement="bottom-end">
                  <PopoverTrigger>
                    <Button
                      disableRipple
                      isIconOnly
                      className="overflow-visible text-default-500"
                      radius="full"
                      variant="light"
                    >
                      <Badge color="danger" content="5" showOutline={false} size="md">
                        <Icon icon="solar:bell-linear" width={22} />
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-[90vw] p-0 sm:max-w-[380px]">
                    <NotificationsCard className="w-full shadow-none" />
                  </PopoverContent>
                </Popover>
              </NavbarItem>

              {/* User Menu */}
              <NavbarItem className="px-2">
                <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                    <button className="mt-1 h-8 w-8 transition-transform">
                      <Badge color="success" content="" placement="bottom-right" shape="circle">
                        <Avatar size="sm" src="https://i.pravatar.cc/150?u=a04258114e29526708c" />
                      </Badge>
                    </button>
                  </DropdownTrigger>
                  <DropdownMenu
                    aria-label="Profile Actions"
                    variant="flat"
                    onAction={key => {
                      switch (key) {
                        case 'profile':
                          router.push('/dashboard/profile');
                          break;
                        case 'preference':
                          router.push('/dashboard/preference');
                          break;
                        case 'github':
                          window.open('https://github.com/', '_blank');
                          break;
                        case 'logout':
                          router.push('/login');
                          break;
                      }
                    }}
                  >
                    <DropdownSection showDivider>
                      <DropdownItem key="user-info" className="h-14 gap-2" isReadOnly>
                        <p className="font-semibold">{t('signedInAs')}</p>
                        <p className="font-semibold text-default-500">johndoe@example.com</p>
                      </DropdownItem>
                    </DropdownSection>
                    <DropdownSection showDivider>
                      <DropdownItem
                        key="profile"
                        startContent={<Icon icon="solar:user-linear" width={16} />}
                      >
                        {t('personalInformation')}
                      </DropdownItem>
                      <DropdownItem
                        key="preference"
                        startContent={<Icon icon="solar:settings-linear" width={16} />}
                      >
                        {t('preference')}
                      </DropdownItem>
                    </DropdownSection>
                    <DropdownSection title={t('learnMore')} showDivider>
                      <DropdownItem
                        key="github"
                        startContent={<Icon icon="mdi:github" width={16} />}
                      >
                        {t('starOnGitHub')}
                      </DropdownItem>
                    </DropdownSection>
                    <DropdownSection>
                      <DropdownItem
                        key="logout"
                        color="danger"
                        startContent={<Icon icon="solar:logout-2-linear" width={16} />}
                      >
                        {t('logout')}
                      </DropdownItem>
                    </DropdownSection>
                  </DropdownMenu>
                </Dropdown>
              </NavbarItem>
            </NavbarContent>
          </Navbar>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto p-6">{children}</div>
        </div>
      </div>
    </>
  );
}
