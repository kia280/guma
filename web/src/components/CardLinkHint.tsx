import { Icon } from '@iconify/react';

interface CardLinkHintProps {
  icon: string;
  label: string;
  tone?: 'accent' | 'subtle' | 'disabled';
}

const toneClass = {
  accent: 'text-accent',
  subtle: 'text-subtle group-hover:text-foreground',
  disabled: 'text-disabled',
};

export function CardLinkHint({ icon, label, tone = 'subtle' }: CardLinkHintProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex w-full items-center justify-between gap-2 border-t border-separator pt-3 type-label transition-colors ${toneClass[tone]}`}
    >
      <span className="flex items-center gap-1.5 min-w-0">
        <Icon icon={icon} width={16} className="shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      {tone !== 'disabled' && (
        <Icon
          icon="solar:alt-arrow-right-linear"
          width={16}
          className="shrink-0 transition-transform group-hover:translate-x-0.5 group-has-[a:focus-visible]:translate-x-0.5 motion-reduce:transition-none"
        />
      )}
    </span>
  );
}
