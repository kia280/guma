'use client';

import { Button } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Heading } from 'react-aria-components';

export function ActionSuccess({
  title,
  detail,
  doneLabel,
  onDone,
}: {
  title: string;
  detail?: React.ReactNode;
  doneLabel?: string;
  onDone?: () => void;
}) {
  const t = useTranslations('actionSuccess');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 px-2 pt-6 pb-2 text-center">
      <div className="action-success-badge flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
        <svg aria-hidden="true" viewBox="0 0 64 64" width={64} height={64} fill="none" stroke="currentColor">
          <circle
            className="action-success-ring"
            cx="32"
            cy="32"
            r="29"
            strokeWidth="3"
            pathLength={1}
            transform="rotate(-90 32 32)"
          />
          <path
            className="action-success-tick"
            d="M20 33.5l8 8 16-17"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
          />
        </svg>
      </div>
      <div role="status" className="action-success-text flex flex-col gap-1">
        <Heading slot="title" ref={headingRef} tabIndex={-1} className="type-heading text-foreground outline-none">
          {title}
        </Heading>
        {detail && <p className="type-body text-subtle">{detail}</p>}
      </div>
      <Button slot="close" variant="primary" className="w-full sm:min-w-32 sm:w-auto" onPress={onDone}>
        {doneLabel ?? t('done')}
      </Button>
    </div>
  );
}
