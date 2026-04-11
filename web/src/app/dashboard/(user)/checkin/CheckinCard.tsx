'use client';

import { Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { CheckinStatus } from './data';

export { CheckinStatus };

const formatExpire = (iso: string) => {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export function CheckinCard({
  status,
  date,
  description,
  expireTime,
  attendanceCount,
  lootCount,
  isDisabled,
  onClick,
}: {
  status: CheckinStatus;
  date: string;
  description: string;
  expireTime?: string;
  attendanceCount?: number;
  lootCount?: number;
  isDisabled?: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations('checkIn');
  const statusConfig = {
    [CheckinStatus.OPEN]: { label: t('statusActive'), color: 'success' as const },
    [CheckinStatus.CLOSED]: { label: t('statusClosed'), color: 'default' as const },
    [CheckinStatus.FINISHED]: { label: t('statusCompleted'), color: 'accent' as const },
  };
  const { label, color } = statusConfig[status];
  const timeLeft = expireTime ? formatExpire(expireTime) : null;

  return (
    <Card
      className={`border border-divider shadow-none bg-surface ${!isDisabled ? 'cursor-pointer hover:border-default-400 transition-colors' : 'opacity-50'}`}
      role={!isDisabled ? 'button' : undefined}
      tabIndex={!isDisabled ? 0 : undefined}
      onClick={!isDisabled ? onClick : undefined}
      onKeyDown={
        !isDisabled
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <Card.Header className="pb-0 pt-4 px-4 flex-col items-start gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip size="sm" color={color} variant="secondary">
            {label}
          </Chip>
          {status === CheckinStatus.OPEN && timeLeft && (
            <Chip size="sm" color="warning" variant="secondary">
              <Icon icon="solar:clock-circle-linear" width={10} />
              {timeLeft}
            </Chip>
          )}
        </div>
        <p className="text-xs text-foreground/40 mt-1">{date}</p>
        <h4 className="font-medium text-base text-foreground">{description}</h4>
        {(attendanceCount !== undefined || lootCount !== undefined) && (
          <div className="flex items-center gap-3 mt-1">
            {attendanceCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-foreground/40">
                <Icon icon="solar:users-group-rounded-linear" width={12} />
                {attendanceCount}
              </span>
            )}
            {lootCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-foreground/40">
                <Icon icon="solar:box-linear" width={12} />
                {lootCount}
              </span>
            )}
          </div>
        )}
      </Card.Header>
      <Card.Content className="pb-4 pt-3">
        <div className="overflow-hidden rounded-lg z-0">
          <img
            alt="Card background"
            className={
              'object-cover w-full' +
              (isDisabled
                ? ' grayscale opacity-50'
                : ' hover:scale-105 transition-transform duration-300')
            }
            src="https://media.discordapp.net/attachments/1366759949568446566/1366760017662967859/image.png?ex=69daedb5&is=69d99c35&hm=1c1b07ce1a88e61b1c8aee25e712d6f8b4bb5880bd31b5958aab57462f2ca28d&=&format=webp&quality=lossless&width=1919&height=917"
          />
        </div>
      </Card.Content>
    </Card>
  );
}
