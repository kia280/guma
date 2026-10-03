import { Icon } from '@iconify/react';
import React from 'react';

const TONES = {
  warning: { box: 'bg-warning/10 border border-warning/20 rounded-lg p-3', icon: 'text-warning', text: 'text-warning' },
  neutral: { box: 'bg-surface-secondary rounded-lg p-3', icon: 'text-subtle', text: 'text-subtle' },
} as const;

export function InfoNote({ tone, children }: { tone: keyof typeof TONES; children: React.ReactNode }) {
  const classes = TONES[tone];
  return (
    <div className={classes.box}>
      <div className="flex items-start gap-2">
        <Icon className={`${classes.icon} shrink-0 mt-0.5`} icon="solar:info-circle-bold" width={14} />
        <p className={`type-caption ${classes.text}`}>{children}</p>
      </div>
    </div>
  );
}
