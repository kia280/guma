import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="type-title text-foreground">{title}</h1>
        {description && <p className="mt-0.5 type-body text-subtle">{description}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 type-body">{children}</div>}
    </div>
  );
}
