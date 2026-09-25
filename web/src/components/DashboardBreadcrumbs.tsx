'use client';

import { Breadcrumbs } from '@heroui/react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { buildCrumbs, type Crumb } from '@/lib/dashboard-nav';

export function DashboardBreadcrumbs() {
  const t = useTranslations('dashboardLayout');
  const pathname = usePathname();
  const tab = useSearchParams().get('tab');
  const crumbs = buildCrumbs(pathname, tab);

  const label = (crumb: Crumb) => (crumb.label.kind === 'nav' ? t(crumb.label.key) : t(`pages.${crumb.label.key}`));

  return (
    <Breadcrumbs aria-label={t('breadcrumbs')} className="min-w-0 type-body">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <Breadcrumbs.Item
            key={`${index}-${crumb.label.key}`}
            href={isLast ? undefined : crumb.href}
            className={isLast ? 'truncate font-medium text-foreground' : 'text-subtle hover:text-foreground'}
          >
            {label(crumb)}
          </Breadcrumbs.Item>
        );
      })}
    </Breadcrumbs>
  );
}
