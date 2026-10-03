import { Icon } from '@iconify/react';
import React from 'react';

export function WarningNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
      <div className="flex items-start gap-2">
        <Icon className="text-warning shrink-0 mt-0.5" icon="solar:info-circle-bold" width={14} />
        <p className="type-caption text-warning">{children}</p>
      </div>
    </div>
  );
}
