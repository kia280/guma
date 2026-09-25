'use client';

import { Avatar } from '@heroui/react';

interface UserAvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackClassName?: string;
}

export function userAvatarFallback(name: string): string {
  return Array.from(name.trim())[0]?.toUpperCase() ?? '?';
}

export function UserAvatar({ name, src, size = 'sm', className, fallbackClassName }: UserAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {src && <Avatar.Image src={src} alt="" />}
      <Avatar.Fallback className={fallbackClassName}>{userAvatarFallback(name)}</Avatar.Fallback>
    </Avatar>
  );
}
