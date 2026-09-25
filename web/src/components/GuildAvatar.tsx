'use client';

import { useState } from 'react';
import { Skeleton, cn } from '@heroui/react';

interface GuildAvatarProps {
  name?: string;
  src?: string;
  size?: 'sm' | 'lg';
  isLoading?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: 'size-7', text: 'type-body font-semibold' },
  lg: { box: 'size-16', text: 'type-title' },
} as const;

export function GuildAvatar({ name = '', src, size = 'sm', isLoading = false, className }: GuildAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const boxClassName = cn(SIZES[size].box, 'shrink-0 rounded-lg', className);

  if (isLoading) {
    return <Skeleton className={boxClassName} />;
  }

  const imageSrc = src && src !== failedSrc ? src : undefined;
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '';

  return (
    <span
      className={cn(boxClassName, 'flex items-center justify-center overflow-hidden bg-accent/15 text-accent')}
      aria-hidden
    >
      {imageSrc ? (
        <img
          key={imageSrc}
          src={imageSrc}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : (
        <span className={SIZES[size].text}>{initial}</span>
      )}
    </span>
  );
}
