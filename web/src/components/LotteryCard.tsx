'use client';

import { Card, Chip, Button, ProgressBar } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCountdown } from '@/hooks/useNow';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { formatPrize, useFormatGold } from '@/lib/guma/useFormatGold';
import { lotteryStatusColor } from '@/lib/status-colors';
import { UserAvatar } from './UserAvatar';

interface LotteryWinner {
  id: string;
  username: string;
  avatar?: string;
  prize: string;
  prizeAmount?: number;
}

interface LotteryCardProps {
  id: string;
  title: string;
  prizePool: number;
  ticketPrice: number;
  drawDate: string;
  ticketsSold: number;
  maxTickets: number;
  status: 'active' | 'upcoming' | 'ended';
  winners?: LotteryWinner[];
}

const LotteryCard = ({
  id,
  title,
  prizePool,
  ticketPrice,
  drawDate,
  ticketsSold,
  maxTickets,
  status,
  winners,
}: LotteryCardProps) => {
  const t = useTranslations('lotteryCard');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const router = useRouter();
  const href = `/dashboard/lottery/${id}`;
  const openDetail = () => router.push(href);
  const hasCap = maxTickets > 0;
  const soldPercent = hasCap ? Math.round((ticketsSold / maxTickets) * 100) : 0;

  const formatCountdown = useCountdownFormatter();
  const { remainingMs, isExpired } = useCountdown(drawDate);
  const isDrawing = status === 'active' && isExpired;
  const countdown = (key: 'timeLeftValue' | 'startsIn') =>
    isExpired ? t('drawComplete') : t(key, { duration: formatCountdown(remainingMs) });

  const progressColor = soldPercent > 80 ? 'danger' : soldPercent > 50 ? 'warning' : 'success';

  return (
    <Card className="border border-divider shadow-none bg-surface hover:border-foreground/20 transition-colors has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus">
      <Card.Header className="pb-2">
        <div className="flex justify-between items-start w-full">
          <div>
            <Chip
              size="sm"
              color={isDrawing ? 'accent' : lotteryStatusColor[status]}
              variant="secondary"
              className="mb-1"
            >
              {isDrawing ? t('drawingNow') : t(`status.${status}`)}
            </Chip>
            <h4 className="type-subheading text-foreground">
              <Link href={href} className="outline-none after:absolute after:inset-0">
                {title}
              </Link>
            </h4>
          </div>
          <Icon icon="solar:ticket-bold-duotone" width={28} className="text-accent/60 shrink-0" />
        </div>
      </Card.Header>

      <Card.Content className="py-3">
        <div className="space-y-4">
          {/* Prize Pool */}
          <div className="text-center py-2">
            <p className="type-caption text-hint">{t('prizePool')}</p>
            <p className="type-display text-foreground mt-1">{formatGold(prizePool)}</p>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex justify-between type-body">
              <span className="text-subtle">{t('ticketPrice')}</span>
              <span className="font-medium text-foreground">{formatGold(ticketPrice)}</span>
            </div>
            <div className="flex justify-between type-body">
              <span className="text-subtle">{t('drawDate')}</span>
              <span className="font-medium text-foreground">
                {format.dateTime(new Date(drawDate), { dateStyle: 'medium' })}
              </span>
            </div>
            {status === 'active' && (
              <div className="flex justify-between type-body">
                <span className="text-subtle">{t('timeLeft')}</span>
                <span className="font-medium text-accent">
                  {isDrawing ? t('drawingNow') : countdown('timeLeftValue')}
                </span>
              </div>
            )}
          </div>

          {/* Tickets Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between type-caption text-hint">
              <span>{t('ticketsSold', { count: ticketsSold })}</span>
              {hasCap && <span>{t('max', { count: maxTickets })}</span>}
            </div>
            {hasCap && (
              <>
                <ProgressBar
                  aria-label={t('ticketsSoldProgress')}
                  className="w-full"
                  value={soldPercent}
                  color={progressColor}
                >
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                <p className="type-caption text-hint text-right">
                  {t('filled', { percent: soldPercent })}
                </p>
              </>
            )}
          </div>

          {/* Winners section for ended lotteries */}
          {status === 'ended' && winners && winners.length > 0 && (
            <div className="space-y-2">
              <p className="type-caption text-hint">{t('winners')}</p>
              {winners.slice(0, 3).map(winner => (
                <div key={winner.id} className="flex items-center gap-2">
                  <UserAvatar name={winner.username} src={winner.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="type-label text-foreground truncate">
                      {winner.username}
                    </p>
                    <p className="type-caption text-success">{formatPrize(winner.prize, winner.prizeAmount, formatGold)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="pt-0">
        {isDrawing && (
          <Button variant="primary" className="w-full" onPress={openDetail}>
            <Icon icon="solar:play-circle-linear" width={16} />
            {t('watchDraw')}
          </Button>
        )}
        {status === 'active' && !isDrawing && (
          <Button variant="primary" className="w-full" onPress={openDetail}>
            <Icon icon="solar:ticket-linear" width={16} />
            {t('buyTicket')}
          </Button>
        )}
        {status === 'ended' && (
          <Button variant="secondary" className="w-full" onPress={openDetail}>
            <Icon icon="solar:cup-star-linear" width={16} />
            {t('viewWinners')}
          </Button>
        )}
        {status === 'upcoming' && (
          <Chip color="warning" variant="secondary" className="w-full justify-center py-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:clock-circle-linear" width={14} />
              <span>{countdown('startsIn')}</span>
            </div>
          </Chip>
        )}
      </Card.Footer>
    </Card>
  );
};

export default LotteryCard;
