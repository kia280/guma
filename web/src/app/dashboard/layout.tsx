'use client';

import React from 'react';
import { Button, Dropdown, Avatar, Badge, Tooltip, Chip, Label } from '@heroui/react';
import { useMediaQuery } from 'usehooks-ts';
import { Icon } from '@iconify/react';
import { useTheme } from 'next-themes';

import { Logo, NotificationBell, SidebarDrawer, Sidebar } from '@/components';
import { cn } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession } from '@/lib/session';
import { useUserStore } from '@/lib/store';
import { CurrentGuildProvider } from '@/lib/current-guild';
import { useLiveBalance } from '@/hooks/useLiveBalance';

interface SidebarItem {
  key: string;
  path: string;
  title: string;
  icon?: string;
  href?: string;
  endContent?: React.ReactNode;
}

export default function DashboardLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
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
      key: 'attendance',
      path: '/attendance',
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

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Derive selected key from the current pathname
  // /dashboard → '', /dashboard/attendance → 'attendance', /dashboard/wallet → 'wallet'
  const selectedKey = React.useMemo(() => {
    const segments = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);
    return segments[0] || '';
  }, [pathname]);

  const isCompact = useMediaQuery('(max-width: 1023px)');
  const showCollapsed = isCollapsed && !isCompact;

  React.useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isCompact) setIsDrawerOpen(false);
  }, [isCompact]);

  const onToggle = React.useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const me = useUserStore(s => s.user);
  useLiveBalance();
  const userBalance = me?.balance ?? 0;
  const displayName = me?.displayName || me?.username || '';
  const avatarFallback = (displayName || me?.email || '?').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <SidebarDrawer
          className={cn('z-50 min-w-[288px]', { 'min-w-[76px] max-w-[76px]': showCollapsed })}
          hideCloseButton={true}
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
        >
          <div
            className={cn(
              'will-change bg-surface border-r border-divider flex h-full flex-col py-[24px] px-[12px]',
              {
                'w-72 max-w-full': !showCollapsed,
                'w-[76px] overflow-hidden': showCollapsed,
              }
            )}
          >
            {/* Sidebar Header — logo + name only, no toggle here */}
            <div className="w-full relative flex items-center px-2 h-[44px]">
              <div className="w-11 flex items-center justify-start shrink-0">
                <Logo size="sm" showText={false} className="h-9 w-9" />
              </div>
              {!showCollapsed && (
                <span className="text-lg font-bold uppercase text-foreground">
                  {t('sunbaby')}
                </span>
              )}
            </div>

            <div className="h-[24px]" />

            <Sidebar
              defaultSelectedKey={selectedKey}
              iconClassName="group-data-[selected=true]:text-foreground"
              isCompact={showCollapsed}
              itemClasses={{
                base: 'rounded-large data-[selected=true]:bg-default!',
                title: 'group-data-[selected=true]:text-foreground group-data-[selected=true]:font-semibold',
              }}
              items={items}
              onSelect={key => {
                const item = items.find(i => i.key === key);
                if (item) router.push(`/dashboard${item.path}`);
                setIsDrawerOpen(false);
              }}
            />

            <div className="h-[32px]" />

            {/* Bottom section: toggle */}
            <div className="mt-auto flex items-center justify-center flex-col gap-1 w-full">
              <Tooltip delay={0}>
                <Button
                  className="text-subtle py-1 px-1 h-[44px] min-h-[44px] w-full"
                  variant="ghost"
                  onPress={isCompact ? () => setIsDrawerOpen(false) : onToggle}
                >
                  {showCollapsed ? (
                    <Icon
                      className="text-subtle"
                      icon="solar:round-alt-arrow-right-line-duotone"
                      width={24}
                    />
                  ) : (
                    <Icon
                      className="text-subtle"
                      icon="solar:round-alt-arrow-left-line-duotone"
                      width={24}
                    />
                  )}
                </Button>
                <Tooltip.Content>
                  {showCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                </Tooltip.Content>
              </Tooltip>
            </div>
          </div>
        </SidebarDrawer>

        <div className="flex-1 flex flex-col z-0 min-w-0">
          {/* Top navbar */}
          <header className="h-[68px] border-b border-divider bg-background flex items-center px-4 sm:px-6 gap-2 shrink-0">
            {isCompact && (
              <Button
                isIconOnly
                className="text-subtle"
                size="sm"
                variant="ghost"
                aria-label={t('openMenu')}
                onPress={() => setIsDrawerOpen(true)}
              >
                <Icon height={24} icon="solar:hamburger-menu-outline" width={24} />
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* Theme toggle */}
              <Button
                isIconOnly
                size="lg"
                className="rounded-full text-subtle"
                variant="ghost"
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Icon
                  icon={theme === 'dark' ? 'solar:sun-linear' : 'solar:moon-linear'}
                  width={22}
                />
              </Button>

              {/* Balance chip */}
              <div className="hidden sm:flex items-center">
                <Chip size="lg" className="cursor-default type-body font-medium tabular-nums">
                  <Icon icon="solar:wallet-linear" width={16} className="inline mr-1.5" />$
                  {userBalance.toLocaleString('en-US')}
                </Chip>
              </div>

              {/* Notifications */}
              <NotificationBell />

              {/* User Menu */}
              <div className="px-2">
                <Dropdown>
                  <Button
                    isIconOnly
                    variant="ghost"
                    className="h-10 w-10 rounded-full relative overflow-visible p-0"
                  >
                    <Badge.Anchor>
                      <Avatar size="md">
                        {me?.avatarUrl && <Avatar.Image src={me.avatarUrl} />}
                        <Avatar.Fallback>{avatarFallback}</Avatar.Fallback>
                      </Avatar>
                      <Badge color="success" placement="bottom-right" size="sm" />
                    </Badge.Anchor>
                  </Button>
                  <Dropdown.Popover>
                    <Dropdown.Menu
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
                            void clearSession();
                            break;
                        }
                      }}
                    >
                      <Dropdown.Section>
                        <Dropdown.Item id="user-info" textValue={t('signedInAs')}>
                          <p className="font-semibold">{displayName || t('signedInAs')}</p>
                          <p className="font-semibold text-subtle">{me?.email ?? ''}</p>
                        </Dropdown.Item>
                      </Dropdown.Section>
                      <Dropdown.Section>
                        <Dropdown.Item id="profile" textValue={t('personalInformation')}>
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:user-linear" width={16} />
                            <Label>{t('personalInformation')}</Label>
                          </div>
                        </Dropdown.Item>
                        <Dropdown.Item id="preference" textValue={t('preference')}>
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:settings-linear" width={16} />
                            <Label>{t('preference')}</Label>
                          </div>
                        </Dropdown.Item>
                      </Dropdown.Section>
                      <Dropdown.Section>
                        <Dropdown.Item id="github" textValue={t('starOnGitHub')}>
                          <div className="flex items-center gap-2">
                            <Icon icon="mdi:github" width={16} />
                            <Label>{t('starOnGitHub')}</Label>
                          </div>
                        </Dropdown.Item>
                      </Dropdown.Section>
                      <Dropdown.Section>
                        <Dropdown.Item id="logout" variant="danger" textValue={t('logout')}>
                          <div className="flex items-center gap-2">
                            <Icon icon="solar:logout-2-linear" width={16} />
                            <Label>{t('logout')}</Label>
                          </div>
                        </Dropdown.Item>
                      </Dropdown.Section>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
            <CurrentGuildProvider>{children}</CurrentGuildProvider>
          </div>
        </div>
      </div>
      <CurrentGuildProvider>{modal}</CurrentGuildProvider>
    </>
  );
}
