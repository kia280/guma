'use client';

import { Button, Card, Chip } from '@heroui/react';
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

export const checkinStatusColor = {
  [CheckinStatus.OPEN]: 'success',
  [CheckinStatus.CLOSED]: 'default',
  [CheckinStatus.FINISHED]: 'accent',
} as const;

export function CheckinCard({
  status,
  date,
  description,
  expireTime,
  attendanceCount,
  lootCount,
  imageUrl,
  isDisabled,
  onClick,
}: {
  status: CheckinStatus;
  date: string;
  description: string;
  expireTime?: string;
  attendanceCount: number;
  lootCount: number;
  imageUrl?: string;
  isDisabled?: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations('checkIn');
  const statusLabel = {
    [CheckinStatus.OPEN]: t('statusActive'),
    [CheckinStatus.CLOSED]: t('statusClosed'),
    [CheckinStatus.FINISHED]: t('statusCompleted'),
  }[status];
  const timeLeft = status === CheckinStatus.OPEN && expireTime ? formatExpire(expireTime) : null;

  return (
    <Card
      className={`border border-divider shadow-none bg-surface ${!isDisabled ? 'cursor-pointer hover:border-foreground/20 transition-colors' : 'opacity-50'}`}
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
      <Card.Header className="pb-2">
        <div className="flex justify-between items-start gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-default shrink-0">
              <Icon icon="heroicons:clipboard-document-check" width={20} className="text-subtle" />
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="type-subheading text-foreground truncate">{description}</h4>
              <p className="type-caption text-hint">{date}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Chip size="sm" color={checkinStatusColor[status]} variant="secondary">
              {statusLabel}
            </Chip>
            {timeLeft && (
              <div className="flex items-center gap-1 type-caption text-hint">
                <Icon icon="solar:clock-circle-linear" width={12} />
                <span>{timeLeft}</span>
              </div>
            )}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="pt-0">
        <div className="space-y-4">
          <div className="aspect-video overflow-hidden rounded-lg bg-surface-secondary">
            {imageUrl ? (
              <img
                alt={description}
                loading="lazy"
                className={
                  'h-full w-full object-cover' +
                  (isDisabled ? ' grayscale' : ' hover:scale-105 transition-transform duration-300')
                }
                src={imageUrl}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Icon icon="solar:gallery-linear" width={32} className="text-disabled" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between type-body">
              <span className="text-subtle">{t('attendees')}</span>
              <span className="font-medium tabular-nums text-foreground">{attendanceCount}</span>
            </div>
            <div className="flex justify-between type-body">
              <span className="text-subtle">{t('loot')}</span>
              <span className="font-medium tabular-nums text-foreground">{lootCount}</span>
            </div>
          </div>
        </div>
      </Card.Content>

      <Card.Footer className="pt-0">
        {status === CheckinStatus.OPEN && (
          <Button variant="primary" className="w-full" isDisabled={isDisabled} onPress={onClick}>
            <Icon icon="solar:check-circle-linear" width={16} />
            {t('markPresent')}
          </Button>
        )}
        {status === CheckinStatus.FINISHED && (
          <Button variant="secondary" className="w-full" isDisabled={isDisabled} onPress={onClick}>
            <Icon icon="solar:eye-linear" width={16} />
            {t('viewDetails')}
          </Button>
        )}
        {status === CheckinStatus.CLOSED && (
          <Chip variant="secondary" className="w-full justify-center py-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:lock-keyhole-linear" width={14} />
              <span>{t('checkinClosed')}</span>
            </div>
          </Chip>
        )}
      </Card.Footer>
    </Card>
  );
}
