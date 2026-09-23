'use client';

import { Card, Chip, Button, ProgressBar, Avatar } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

interface LotteryWinner {
  id: string;
  username: string;
  avatar?: string;
  prize: string;
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
  onBuyTicket?: (id: string) => void;
  onViewWinners?: (id: string) => void;
}

const getStatusColor = (status: LotteryCardProps['status']) => {
  switch (status) {
    case 'active':
      return 'accent';
    case 'upcoming':
      return 'warning';
    case 'ended':
      return 'default';
  }
};

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
  onBuyTicket,
  onViewWinners,
}: LotteryCardProps) => {
  const t = useTranslations('lotteryCard');
  const soldPercent = Math.round((ticketsSold / maxTickets) * 100);

  const formatCountdown = (dateStr: string, suffix = t('remaining')) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return t('drawComplete');
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h ${suffix}`;
    if (hours > 0) return `${hours}h ${mins}m ${suffix}`;
    return `${mins}m ${suffix}`;
  };

  const progressColor = soldPercent > 80 ? 'danger' : soldPercent > 50 ? 'warning' : 'success';

  return (
    <Card className="border border-divider shadow-none bg-surface hover:border-foreground/20 transition-colors">
      <Card.Header className="pb-2">
        <div className="flex justify-between items-start w-full">
          <div>
            <Chip
              size="sm"
              color={getStatusColor(status)}
              variant="secondary"
              className="capitalize mb-1"
            >
              {status}
            </Chip>
            <h4 className="text-base font-medium text-foreground">{title}</h4>
          </div>
          <Icon icon="solar:ticket-bold-duotone" width={28} className="text-accent/60 shrink-0" />
        </div>
      </Card.Header>

      <Card.Content className="py-3">
        <div className="space-y-4">
          {/* Prize Pool */}
          <div className="text-center py-2">
            <p className="text-xs text-foreground/40 uppercase tracking-wide">{t('prizePool')}</p>
            <p className="text-3xl font-semibold text-foreground mt-1">${prizePool.toLocaleString()}</p>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/50">{t('ticketPrice')}</span>
              <span className="font-medium text-foreground">${ticketPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-foreground/50">{t('drawDate')}</span>
              <span className="font-medium text-foreground">
                {new Date(drawDate).toLocaleDateString()}
              </span>
            </div>
            {status === 'active' && (
              <div className="flex justify-between text-sm">
                <span className="text-foreground/50">{t('timeLeft')}</span>
                <span className="font-medium text-accent">{formatCountdown(drawDate)}</span>
              </div>
            )}
          </div>

          {/* Tickets Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-foreground/40">
              <span>
                {ticketsSold.toLocaleString()} {t('ticketsSold')}
              </span>
              <span>
                {maxTickets.toLocaleString()} {t('max')}
              </span>
            </div>
            <ProgressBar
              aria-label="Tickets sold"
              className="w-full"
              value={soldPercent}
              color={progressColor}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <p className="text-xs text-foreground/40 text-right">
              {soldPercent}% {t('filled')}
            </p>
          </div>

          {/* Winners section for ended lotteries */}
          {status === 'ended' && winners && winners.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-foreground/40 uppercase tracking-wide">{t('winners')}</p>
              {winners.slice(0, 3).map(winner => (
                <div key={winner.id} className="flex items-center gap-2">
                  <Avatar size="sm">
                    <Avatar.Image src={winner.avatar} />
                    <Avatar.Fallback>{winner.username?.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {winner.username}
                    </p>
                    <p className="text-xs text-success">{winner.prize}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="pt-0">
        {status === 'active' && (
          <Button variant="primary" className="w-full" onPress={() => onBuyTicket?.(id)}>
            <Icon icon="solar:ticket-linear" width={16} />
            {t('buyTicket')}
          </Button>
        )}
        {status === 'ended' && (
          <Button variant="secondary" className="w-full" onPress={() => onViewWinners?.(id)}>
            <Icon icon="solar:trophy-linear" width={16} />
            {t('viewWinners')}
          </Button>
        )}
        {status === 'upcoming' && (
          <Chip color="warning" variant="secondary" className="w-full justify-center py-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:clock-circle-linear" width={14} />
              <span>
                {t('starts')} {formatCountdown(drawDate, t('fromNow'))}
              </span>
            </div>
          </Chip>
        )}
      </Card.Footer>
    </Card>
  );
};

export default LotteryCard;
