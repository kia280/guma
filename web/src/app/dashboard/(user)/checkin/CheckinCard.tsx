'use client';

import { Card, CardHeader, CardBody, Image, Chip } from '@heroui/react';
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
    [CheckinStatus.FINISHED]: { label: t('statusCompleted'), color: 'primary' as const },
  };
  const { label, color } = statusConfig[status];
  const timeLeft = expireTime ? formatExpire(expireTime) : null;

  return (
    <Card
      className="border border-divider shadow-none bg-content1"
      isDisabled={isDisabled}
      isPressable={!isDisabled}
      onPress={onClick}
    >
      <CardHeader className="pb-0 pt-4 px-4 flex-col items-start gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Chip size="sm" color={color} variant="flat">
            {label}
          </Chip>
          {status === CheckinStatus.OPEN && timeLeft && (
            <Chip
              size="sm"
              color="warning"
              variant="flat"
              startContent={<Icon icon="solar:clock-circle-linear" width={10} />}
            >
              {timeLeft}
            </Chip>
          )}
        </div>
        <p className="text-xs text-default-400 mt-1">{date}</p>
        <h4 className="font-medium text-base text-foreground">{description}</h4>
        {(attendanceCount !== undefined || lootCount !== undefined) && (
          <div className="flex items-center gap-3 mt-1">
            {attendanceCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-default-400">
                <Icon icon="solar:users-group-rounded-linear" width={12} />
                {attendanceCount}
              </span>
            )}
            {lootCount !== undefined && (
              <span className="flex items-center gap-1 text-xs text-default-400">
                <Icon icon="solar:box-linear" width={12} />
                {lootCount}
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardBody className="pb-4 pt-3">
        <div className="overflow-hidden rounded-lg z-0">
          <Image
            alt="Card background"
            className={
              'object-cover w-full' +
              (isDisabled
                ? ' grayscale opacity-50'
                : ' hover:scale-105 transition-transform duration-300')
            }
            src="https://media.discordapp.net/attachments/1371110249561587798/1371112013320683671/1840.png?ex=68c81012&is=68c6be92&hm=42429a5409faa6a50fcb822d55aebc868887368ac9735087c43665d7dd05cf04&=&format=webp&quality=lossless&width=825&height=464"
          />
        </div>
      </CardBody>
    </Card>
  );
}
