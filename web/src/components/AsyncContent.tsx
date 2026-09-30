'use client';

import { Button, Skeleton } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { LoadState } from '@/hooks/useLoadState';

export function AsyncContent({
  state,
  onRetry,
  skeleton,
  children,
}: {
  state: LoadState;
  onRetry?: () => void;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('feedback');

  if (state === 'loading') return <>{skeleton}</>;
  if (state === 'failed') {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Icon icon="solar:danger-circle-linear" width={40} className="text-danger" aria-hidden />
        <p className="type-body text-subtle">{t('loadFailed')}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onPress={onRetry}>
            <Icon icon="solar:restart-linear" width={16} aria-hidden />
            {t('retry')}
          </Button>
        )}
      </div>
    );
  }
  return <>{children}</>;
}

export function EmptyContent({
  icon,
  title,
  description,
  minHeight,
  children,
}: {
  icon: string;
  title: string;
  description?: string;
  minHeight?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${minHeight === undefined ? 'py-12' : ''}`}
      style={minHeight === undefined ? undefined : { minHeight }}
    >
      <Icon icon={icon} width={40} className="mb-3 text-disabled" aria-hidden />
      <p className="type-subheading text-foreground">{title}</p>
      {description && <p className="type-body text-subtle mt-1">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2 rounded-lg" />
            <Skeleton className="h-3 w-1/3 rounded-lg" />
          </div>
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({
  count = 4,
  className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4',
  cardClassName = 'h-40 rounded-xl',
}: {
  count?: number;
  className?: string;
  cardClassName?: string;
}) {
  return (
    <div className={className} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={cardClassName} />
      ))}
    </div>
  );
}

export function AsyncValue({
  state,
  className = 'h-10 w-40 rounded-lg',
  fallbackClassName = 'type-display text-disabled',
  children,
}: {
  state: LoadState;
  className?: string;
  fallbackClassName?: string;
  children: ReactNode;
}) {
  if (state === 'loading') return <Skeleton className={className} aria-busy="true" />;
  if (state === 'failed') return <p className={fallbackClassName}>&mdash;</p>;
  return <>{children}</>;
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-3 h-64 rounded-xl" />
        <Skeleton className="lg:col-span-2 h-64 rounded-xl" />
      </div>
    </div>
  );
}
