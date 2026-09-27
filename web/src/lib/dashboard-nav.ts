export type NavLabelKey =
  | 'dashboard'
  | 'checkin'
  | 'calendar'
  | 'auction'
  | 'lottery'
  | 'wallet'
  | 'guildBank'
  | 'admin'
  | 'adminInbox'
  | 'adminMembers'
  | 'adminRequests'
  | 'adminTemplates'
  | 'adminGuild'
  | 'adminAnnouncements'
  | 'adminRoles';

export type NavSectionKey = 'activities' | 'assets';

export interface NavLink {
  key: string;
  href: string;
  icon: string;
  label: NavLabelKey;
  shortcut?: string;
}

export interface NavGroup extends NavLink {
  children: NavLink[];
}

export interface NavSection {
  key: string;
  label?: NavSectionKey;
  items: Array<NavLink | NavGroup>;
}

export const ADMIN_TABS = ['inbox', 'users', 'bankRequests', 'templates', 'guild', 'announcements'] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

const ADMIN_TAB_LABELS: Record<AdminTab, NavLabelKey> = {
  inbox: 'adminInbox',
  users: 'adminMembers',
  bankRequests: 'adminRequests',
  templates: 'adminTemplates',
  guild: 'adminGuild',
  announcements: 'adminAnnouncements',
};

export const adminTabHref = (tab: AdminTab) => `/dashboard/admin?tab=${tab}`;

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'main',
    items: [{ key: 'home', href: '/dashboard', icon: 'solar:home-2-linear', label: 'dashboard', shortcut: 'h' }],
  },
  {
    key: 'activities',
    label: 'activities',
    items: [
      { key: 'attendance', href: '/dashboard/attendance', icon: 'solar:clipboard-check-linear', label: 'checkin', shortcut: 'a' },
      { key: 'calendar', href: '/dashboard/calendar', icon: 'solar:calendar-linear', label: 'calendar', shortcut: 'c' },
      { key: 'auction', href: '/dashboard/auction', icon: 'solar:sledgehammer-linear', label: 'auction', shortcut: 'u' },
      { key: 'lottery', href: '/dashboard/lottery', icon: 'solar:ticket-linear', label: 'lottery', shortcut: 'l' },
    ],
  },
  {
    key: 'assets',
    label: 'assets',
    items: [
      { key: 'wallet', href: '/dashboard/wallet', icon: 'solar:wallet-linear', label: 'wallet', shortcut: 'w' },
      { key: 'guild-bank', href: '/dashboard/guild-bank', icon: 'solar:safe-square-linear', label: 'guildBank', shortcut: 'b' },
    ],
  },
  {
    key: 'admin',
    items: [
      {
        key: 'admin',
        href: '/dashboard/admin',
        icon: 'solar:settings-minimalistic-linear',
        label: 'admin',
        shortcut: 's',
        children: [
          { key: 'admin-inbox', href: adminTabHref('inbox'), icon: 'solar:inbox-in-linear', label: 'adminInbox' },
          { key: 'admin-users', href: adminTabHref('users'), icon: 'solar:users-group-rounded-linear', label: 'adminMembers' },
          { key: 'admin-requests', href: adminTabHref('bankRequests'), icon: 'solar:inbox-linear', label: 'adminRequests' },
          { key: 'admin-templates', href: adminTabHref('templates'), icon: 'solar:layers-minimalistic-linear', label: 'adminTemplates' },
          { key: 'admin-guild', href: adminTabHref('guild'), icon: 'solar:widget-linear', label: 'adminGuild' },
          { key: 'admin-announcements', href: adminTabHref('announcements'), icon: 'solar:document-text-linear', label: 'adminAnnouncements' },
          { key: 'admin-roles', href: '/dashboard/admin/roles', icon: 'solar:shield-user-linear', label: 'adminRoles' },
        ],
      },
    ],
  },
];

export const isNavGroup = (item: NavLink | NavGroup): item is NavGroup => 'children' in item;

export const NAV_SHORTCUTS: Record<string, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap(section => section.items)
    .filter(item => item.shortcut)
    .map(item => [item.shortcut!, item.href]),
);

export const adminTabFromParam = (value: string | null): AdminTab =>
  value === 'activity' ? 'guild' : ADMIN_TABS.find(tab => tab === value) ?? 'inbox';

export const isLinkActive = (href: string, pathname: string, tab: string | null) => {
  const [path, query] = href.split('?');
  if (query) {
    const linkTab = new URLSearchParams(query).get('tab');
    return pathname === path && adminTabFromParam(tab) === linkTab;
  }
  if (path === '/dashboard') return pathname === path;
  if (path === '/dashboard/admin') return pathname === path || pathname.startsWith(`${path}/`);
  return pathname === path || pathname.startsWith(`${path}/`);
};

export type CrumbLabel =
  | { kind: 'nav'; key: NavLabelKey }
  | { kind: 'page'; key: 'detail' | 'editAnnouncement' | 'profile' | 'preference' | 'terms' | 'contact' };

export interface Crumb {
  label: CrumbLabel;
  href?: string;
}

const SECTION_PAGES: Record<string, NavLabelKey> = {
  attendance: 'checkin',
  calendar: 'calendar',
  auction: 'auction',
  lottery: 'lottery',
  wallet: 'wallet',
  'guild-bank': 'guildBank',
};

const STANDALONE_PAGES = ['profile', 'preference', 'terms', 'contact'] as const;

export function buildCrumbs(pathname: string, tab: string | null): Crumb[] {
  const segments = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);
  const [first, second, third] = segments;
  const nav = (key: NavLabelKey, href?: string): Crumb => ({ label: { kind: 'nav', key }, href });

  if (!first) return [nav('dashboard')];

  if (first === 'admin') {
    const admin = nav('admin', '/dashboard/admin');
    if (!second) return [admin, nav(ADMIN_TAB_LABELS[adminTabFromParam(tab)])];
    if (second === 'roles') return [admin, nav('adminRoles')];
    if (second === 'announcements') {
      const announcements = nav('adminAnnouncements', adminTabHref('announcements'));
      return third ? [admin, announcements, { label: { kind: 'page', key: 'editAnnouncement' } }] : [admin, announcements];
    }
    return [admin];
  }

  const section = SECTION_PAGES[first];
  if (section) {
    return second
      ? [nav(section, `/dashboard/${first}`), { label: { kind: 'page', key: 'detail' } }]
      : [nav(section)];
  }

  const standalone = STANDALONE_PAGES.find(page => page === first);
  if (standalone) return [{ label: { kind: 'page', key: standalone } }];

  return [nav('dashboard', '/dashboard')];
}
