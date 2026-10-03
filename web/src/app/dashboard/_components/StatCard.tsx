import { Icon } from '@iconify/react';
import React from 'react';

export function StatCard({
  icon,
  iconClass,
  iconBg,
  label,
  value,
}: {
  icon: string;
  iconClass: string;
  iconBg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center min-w-0 gap-2.5 sm:gap-3 p-3 rounded-xl border border-transparent shadow-edge bg-surface">
      <div className={`${iconBg} p-2 sm:p-2.5 rounded-lg shrink-0`}>
        <Icon icon={icon} width={18} className={iconClass} />
      </div>
      <div className="flex flex-col min-w-0">
        <p className="type-caption text-hint">{label}</p>
        <p className="type-heading sm:type-title tabular-nums text-foreground mt-0.5 wrap-anywhere">{value}</p>
      </div>
    </div>
  );
}
