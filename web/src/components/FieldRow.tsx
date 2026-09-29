import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

export function FieldRow({ children }: { children: ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function LockedValue({ label, value }: { label: string; value: string }) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-col gap-1">
      <span className="type-label text-soft" aria-hidden>
        {label}
      </span>
      <span className="flex min-h-10 items-center gap-2 rounded-lg bg-surface-secondary px-3 type-body tabular-nums text-foreground">
        <Icon
          icon="solar:lock-keyhole-linear"
          width={14}
          className="shrink-0 text-hint"
          aria-hidden
        />
        <span className="min-w-0 break-all">{value}</span>
      </span>
    </div>
  );
}
