'use client';

import { Card, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CardFooterStatus } from '@/components/CardFooterStatus';
import { CardLinkHint } from '@/components/CardLinkHint';
import { useCountdown } from '@/hooks/useNow';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { rollCallStatusColor } from '@/lib/status-colors';
import { RollCallStatus } from './data';

export { RollCallStatus };

const formatEventDate = (value: string, format: ReturnType<typeof useIntlFormatter>) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
};

export function RollCallCard({
  status,
  date,
  title,
  expireTime,
  attendanceCount,
  lootCount,
  goldLoot,
  imageUrl,
  isDisabled,
  href,
}: {
  status: RollCallStatus;
  date: string;
  title: string;
  expireTime?: string;
  attendanceCount: number;
  lootCount: number;
  goldLoot?: number;
  imageUrl?: string;
  isDisabled?: boolean;
  href: string;
}) {
  const t = useTranslations('rollCall');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const formatCountdown = useCountdownFormatter();
  const { remainingMs, isExpired } = useCountdown(status === RollCallStatus.OPEN ? expireTime : null);
  const statusLabel = {
    [RollCallStatus.OPEN]: t('statusActive'),
    [RollCallStatus.CANCELLED]: t('statusCancelled'),
    [RollCallStatus.FINISHED]: t('statusEnded'),
    [RollCallStatus.COMPLETED]: t('statusCompleted'),
  }[status];
  const canCheckIn = status === RollCallStatus.OPEN && !isExpired;
  const timeLeft = canCheckIn && expireTime ? formatCountdown(remainingMs) : null;

  return (
    <Card
      className={`border border-divider shadow-none bg-surface ${
        !isDisabled
          ? 'group hover:border-foreground/20 transition-colors has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus'
          : 'opacity-50'
      }`}
    >
      <Card.Header className="pb-2">
        <div className="flex justify-between items-start gap-3 w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-default shrink-0">
              <Icon icon="heroicons:clipboard-document-check" width={20} className="text-subtle" />
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="type-subheading text-foreground truncate">
                {isDisabled ? (
                  title
                ) : (
                  <Link href={href} className="outline-none after:absolute after:inset-0">
                    {title}
                  </Link>
                )}
              </h4>
              <p className="type-caption text-hint">{formatEventDate(date, format)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 type-caption">
            <Chip size="sm" color={rollCallStatusColor[status]} variant="secondary">
              {statusLabel}
            </Chip>
            {timeLeft && (
              <div className="flex items-center gap-1 text-hint">
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
                alt={title}
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
              <span className="text-subtle">{t('loot')}</span>
              <span className="font-medium tabular-nums text-foreground">{lootCount}</span>
            </div>
            {goldLoot !== undefined && (
              <div className="flex justify-between type-body">
                <span className="text-subtle">{t('goldLoot')}</span>
                <span className="font-medium tabular-nums text-foreground">{formatGold(goldLoot)}</span>
              </div>
            )}
            <div className="flex justify-between type-body">
              <span className="text-subtle">{t('attendees')}</span>
              <span className="font-medium tabular-nums text-foreground">{attendanceCount}</span>
            </div>
          </div>
        </div>
      </Card.Content>

      <Card.Footer className="pt-0">
        {canCheckIn && (
          <CardLinkHint
            icon="solar:check-circle-linear"
            label={t('openRollCall')}
            tone={isDisabled ? 'disabled' : 'accent'}
          />
        )}
        {(status === RollCallStatus.FINISHED || status === RollCallStatus.COMPLETED) && (
          <CardLinkHint
            icon="solar:eye-linear"
            label={t('viewDetails')}
            tone={isDisabled ? 'disabled' : 'subtle'}
          />
        )}
        {status === RollCallStatus.CANCELLED && (
          <CardFooterStatus icon="solar:forbidden-circle-linear" label={t('rollCallCancelled')} />
        )}
        {status === RollCallStatus.OPEN && !canCheckIn && (
          <CardFooterStatus icon="solar:lock-keyhole-linear" label={t('rollCallClosed')} />
        )}
      </Card.Footer>
    </Card>
  );
}
