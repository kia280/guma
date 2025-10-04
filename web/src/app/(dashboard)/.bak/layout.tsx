"use client"
// import { ProtectedRoute } from '@/lib/auth/auth-context';
import DesktopSidebar from './DesktopSidebar';
import ProfileDropdown from './ProfileDropdown';
import MobileSidebar from '../MobileSidebar';
import { useTranslations } from 'next-intl';
import {
  HomeIcon,
  PencilSquareIcon,
  ScaleIcon,
  WalletIcon,
  UsersIcon,
  CalendarIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import React from 'react';
import { usePathname } from 'next/navigation';
// import { useAuth } from '@/lib/auth/auth-context';

function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

interface NavigationItem {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  href: string;
  current: boolean;
  permissions?: string[];
  roles?: string[];
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = useTranslations('Sidebar');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const pathname = usePathname();
  // const { hasPermission, hasRole } = useAuth();

  const userNavigation = [
    { name: 'Profile', href: '/profile' },
    { name: 'Settings', href: '/settings' },
    { name: 'Logout', href: '#' },
  ]

  const allNavigation: NavigationItem[] = [
    { 
      icon: HomeIcon, 
      name: t('dashboard') || 'Dashboard', 
      href: `/dashboard`, 
      current: pathname === '/dashboard'
    },
    { 
      icon: UsersIcon, 
      name: 'Guilds', 
      href: `/guilds`, 
      current: pathname.startsWith('/guilds')
    },
    { 
      icon: CalendarIcon, 
      name: 'Events', 
      href: `/events`, 
      current: pathname.startsWith('/events'),
      permissions: ['events.read']
    },
    { 
      icon: PencilSquareIcon, 
      name: t('CHECK_IN') || 'Check In', 
      href: `/checkin`, 
      current: pathname === '/checkin'
    },
    { 
      icon: ScaleIcon, 
      name: t('loot') || 'Auction', 
      href: `/auction`, 
      current: pathname.startsWith('/auction')
    },
    { 
      icon: WalletIcon, 
      name: t('WALLET') || 'Wallet', 
      href: '/wallet', 
      current: pathname.startsWith('/wallet')
    },
    { 
      icon: CogIcon, 
      name: 'Administration', 
      href: '/admin', 
      current: pathname.startsWith('/admin'),
      roles: ['admin']
    },
  ];

  // Filter navigation based on permissions
  const navigation = allNavigation.filter(item => {
    // if (item.permissions) {
    //   return item.permissions.some(permission => hasPermission(permission));
    // }
    
    // if (item.roles) {
    //   return item.roles.some(role => hasRole(role));
    // }
    
    return true;
  });

  return (
    // <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Mobile sidebar */}
        <MobileSidebar 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
          navigation={navigation} 
        />
        
        {/* Static sidebar for desktop */}
        <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
          <DesktopSidebar navigation={navigation} />
        </div>

        {/* Main content */}
        <div className="lg:pl-72">
          {/* Top navigation */}
          <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-divider bg-background px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-foreground-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Separator */}
            <div className="h-6 w-px bg-divider lg:hidden" aria-hidden="true" />

            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1"></div>
              <div className="flex items-center gap-x-4 lg:gap-x-6">
                <ProfileDropdown 
                  userNavigation={userNavigation} 
                  setSidebarOpen={setSidebarOpen} 
                />
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="py-10">
            <div className="px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    // </ProtectedRoute>
  )
}
