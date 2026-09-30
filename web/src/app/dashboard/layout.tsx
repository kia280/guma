'use client';

import { Button, Dropdown, Badge, Tooltip, Chip, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';
import { useMediaQuery } from 'usehooks-ts';
import { NotificationBell, SidebarDrawer } from '@/components';
import { AppSidebar, ShortcutKeys } from '@/components/AppSidebar';
import { DashboardBreadcrumbs } from '@/components/DashboardBreadcrumbs';
import { DevImpersonationIndicator } from '@/components/dev/DevImpersonationIndicator';
import { UserAvatar } from '@/components/UserAvatar';
import { useDashboardShortcuts } from '@/hooks/useDashboardShortcuts';
import { useLiveBalance } from '@/hooks/useLiveBalance';
import { CurrentGuildProvider } from '@/lib/current-guild';
import { env } from '@/lib/env';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { isGuildRole } from '@/lib/permissions';
import { clearSession } from '@/lib/session';
import { useUserStore } from '@/lib/store';
import { ownUserName } from '@/lib/user-name';

const COLLAPSED_STORAGE_KEY = 'guma-sidebar-collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

const saveCollapsed = (value: boolean) => {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, value ? '1' : '0');
  } catch {
    return;
  }
};

export default function DashboardLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const t = useTranslations('dashboardLayout');
  const roleLabels = useTranslations('adminPage.roles');
  const formatGold = useFormatGold();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const isCompact = useMediaQuery('(max-width: 1023px)', { initializeWithValue: false });
  const showCollapsed = isCollapsed && !isCompact;

  React.useEffect(() => {
    setIsCollapsed(readCollapsed());
  }, []);

  React.useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!isCompact) setIsDrawerOpen(false);
  }, [isCompact]);

  const toggleSidebar = React.useCallback(() => {
    if (isCompact) {
      setIsDrawerOpen(open => !open);
      return;
    }
    setIsCollapsed(collapsed => {
      saveCollapsed(!collapsed);
      return !collapsed;
    });
  }, [isCompact]);

  useDashboardShortcuts({ onToggleSidebar: toggleSidebar, onNavigate: href => router.push(href) });

  const me = useUserStore(s => s.user);
  useLiveBalance();
  const userBalance = me?.balance ?? 0;
  const displayName = ownUserName(me);
  const roleLabel = isGuildRole(me?.guildRole) ? roleLabels(me.guildRole) : '';
  const toggleLabel = isCompact ? t('openMenu') : showCollapsed ? t('expandSidebar') : t('collapseSidebar');

  return (
    <>
      <div className="flex h-screen w-full bg-background">
        <SidebarDrawer className="z-50" label={t('navigation')} isOpen={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <AppSidebar isCollapsed={showCollapsed} onNavigate={() => setIsDrawerOpen(false)} />
        </SidebarDrawer>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 bg-background px-3 py-2">
            <div className="flex h-11 items-center gap-2 px-1.5 sm:h-10">
              <Tooltip delay={300}>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="size-11 min-w-11 text-subtle sm:size-7 sm:min-w-7"
                  aria-label={toggleLabel}
                  aria-expanded={isCompact ? isDrawerOpen : !showCollapsed}
                  onPress={toggleSidebar}
                >
                  <Icon icon="solar:sidebar-minimalistic-linear" width={18} aria-hidden />
                </Button>
                <Tooltip.Content className="flex items-center gap-2">
                  <span>{toggleLabel}</span>
                  <ShortcutKeys keys={['[']} />
                </Tooltip.Content>
              </Tooltip>

              <React.Suspense fallback={null}>
                <DashboardBreadcrumbs />
              </React.Suspense>

              <div className="ml-auto flex items-center gap-2">
                {env.devTools && <DevImpersonationIndicator />}

                <Button
                  isIconOnly
                  size="sm"
                  className="size-11 min-w-11 text-subtle sm:size-7 sm:min-w-7"
                  variant="ghost"
                  aria-label={t('toggleTheme')}
                  onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  <Icon icon={theme === 'dark' ? 'solar:sun-linear' : 'solar:moon-linear'} width={18} aria-hidden />
                </Button>

                <div className="hidden sm:flex items-center type-body">
                  <Chip size="lg" className="cursor-default gap-1.5 tabular-nums">
                    <Icon icon="solar:wallet-linear" width={16} className="text-subtle" aria-hidden />
                    <span>{formatGold(userBalance)}</span>
                  </Chip>
                </div>

                <NotificationBell />

                {/* User Menu */}
                <div>
                  <Dropdown>
                    <Button
                      isIconOnly
                      variant="ghost"
                      aria-label={t('accountMenu', { name: displayName })}
                      className="size-11 min-w-11 rounded-full relative overflow-visible p-0 sm:size-7 sm:min-w-7"
                    >
                      <Badge.Anchor>
                        <UserAvatar name={displayName} src={me?.avatarUrl} className="size-7" />
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
                            case 'terms':
                              router.push('/dashboard/terms');
                              break;
                            case 'contact':
                              router.push('/dashboard/contact');
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
                            {roleLabel && <p className="font-semibold text-subtle">{roleLabel}</p>}
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
                          <Dropdown.Item id="contact" textValue={t('pages.contact')}>
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:chat-round-dots-linear" width={16} />
                              <Label>{t('pages.contact')}</Label>
                            </div>
                          </Dropdown.Item>
                          <Dropdown.Item id="terms" textValue={t('pages.terms')}>
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:document-text-linear" width={16} />
                              <Label>{t('pages.terms')}</Label>
                            </div>
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="github"
                            textValue={t('starOnGitHub')}
                            href="https://github.com/kia280/guma"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
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
            </div>
          </header>

          <main className="flex-1 overflow-auto px-4.5 pb-4.5">
            <CurrentGuildProvider>{children}</CurrentGuildProvider>
          </main>
        </div>
      </div>
      <CurrentGuildProvider>{modal}</CurrentGuildProvider>
    </>
  );
}
