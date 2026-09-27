import { Icon } from '@iconify/react';

interface CardFooterStatusProps {
  icon: string;
  label: string;
  tone?: 'subtle' | 'warning';
}

const toneClass = {
  subtle: 'text-subtle',
  warning: 'text-warning',
};

export function CardFooterStatus({ icon, label, tone = 'subtle' }: CardFooterStatusProps) {
  return (
    <span
      className={`flex w-full items-center gap-1.5 border-t border-separator pt-3 type-label ${toneClass[tone]}`}
    >
      <Icon icon={icon} width={16} className="shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
