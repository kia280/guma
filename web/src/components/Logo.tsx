'use client';

import { useState } from 'react';
import Image from 'next/image';
import clsx from 'clsx';

interface LogoProps {
  /** Size variant of the logo */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to show the text alongside the logo */
  showText?: boolean;
  /** Custom className for styling */
  className?: string;
  /** Custom text to display alongside logo */
  text?: string;
  /** Whether the logo should be clickable */
  clickable?: boolean;
  /** Priority loading for the image */
  priority?: boolean;
  src?: string;
}

// Size mappings for the logo
const sizeMap = {
  xs: {
    imageSize: 24,
    textSize: 'text-sm',
    asset: '/assets/logo/sunbaby-48x48.png',
  },
  sm: {
    imageSize: 32,
    textSize: 'text-base',
    asset: '/assets/logo/sunbaby-48x48.png',
  },
  md: {
    imageSize: 48,
    textSize: 'text-lg',
    asset: '/assets/logo/sunbaby-96x96.png',
  },
  lg: {
    imageSize: 64,
    textSize: 'text-xl',
    asset: '/assets/logo/sunbaby-96x96.png',
  },
  xl: {
    imageSize: 96,
    textSize: 'text-2xl',
    asset: '/assets/logo/sunbaby-256x256.png',
  },
} as const;

export function Logo({
  size = 'md',
  showText = true,
  className,
  text = 'Guma',
  clickable = false,
  priority = false,
  src,
}: LogoProps) {
  const config = sizeMap[size];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const customSrc = src && src !== failedSrc ? src : undefined;

  const logoContent = (
    <div className={clsx(
      'flex items-center gap-2',
      clickable && 'transition-opacity hover:opacity-80 cursor-pointer',
      className
    )}>
      <Image
        key={customSrc ?? config.asset}
        src={customSrc ?? config.asset}
        alt={`${text} Logo`}
        width={config.imageSize}
        height={config.imageSize}
        priority={priority}
        unoptimized={Boolean(customSrc)}
        onError={customSrc ? () => setFailedSrc(customSrc) : undefined}
        className={clsx('rounded-lg', customSrc && 'object-cover aspect-square')}
      />
      {showText && (
        <span className={clsx(
          'font-bold text-foreground',
          config.textSize
        )}>
          {text}
        </span>
      )}
    </div>
  );

  return logoContent;
}

// Export individual logo variants for convenience
export function LogoIcon({ size = 'md', className, priority = false }: Pick<LogoProps, 'size' | 'className' | 'priority'>) {
  return (
    <Logo 
      size={size} 
      showText={false} 
      className={className}
      priority={priority}
    />
  );
}

export function LogoWithText({ 
  size = 'md', 
  text = 'Guma', 
  className, 
  priority = false 
}: Pick<LogoProps, 'size' | 'text' | 'className' | 'priority'>) {
  return (
    <Logo 
      size={size} 
      showText={true} 
      text={text} 
      className={className}
      priority={priority}
    />
  );
}
