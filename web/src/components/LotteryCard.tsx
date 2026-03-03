'use client';

import {
  Card,
  CardBody,
  CardHeader,
  CardFooter,
  Chip,
  Button,
  Progress,
  Avatar,
} from '@heroui/react';
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
      return 'success';
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

  return (
    <Card className="border border-divider shadow-none bg-content1 hover:border-default-400 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start w-full">
          <div>
            <Chip
              size="sm"
              color={getStatusColor(status)}
              variant="flat"
              className="capitalize mb-1"
            >
              {status}
            </Chip>
            <h4 className="text-base font-medium text-foreground">{title}</h4>
          </div>
          <Icon icon="solar:ticket-bold-duotone" width={28} className="text-primary/60 shrink-0" />
        </div>
      </CardHeader>

      <CardBody className="py-3">
        <div className="space-y-4">
          {/* Prize Pool */}
          <div className="text-center py-2">
            <p className="text-xs text-default-400 uppercase tracking-wide">{t('prizePool')}</p>
            <p className="text-3xl font-bold text-foreground mt-1">${prizePool.toLocaleString()}</p>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-default-500">{t('ticketPrice')}</span>
              <span className="font-medium text-foreground">${ticketPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-default-500">{t('drawDate')}</span>
              <span className="font-medium text-foreground">
                {new Date(drawDate).toLocaleDateString()}
              </span>
            </div>
            {status === 'active' && (
              <div className="flex justify-between text-sm">
                <span className="text-default-500">{t('timeLeft')}</span>
                <span className="font-medium text-primary">{formatCountdown(drawDate)}</span>
              </div>
            )}
          </div>

          {/* Tickets Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-default-400">
              <span>
                {ticketsSold.toLocaleString()} {t('ticketsSold')}
              </span>
              <span>
                {maxTickets.toLocaleString()} {t('max')}
              </span>
            </div>
            <Progress
              value={soldPercent}
              color={soldPercent > 80 ? 'danger' : soldPercent > 50 ? 'warning' : 'primary'}
              size="sm"
            />
            <p className="text-xs text-default-400 text-right">
              {soldPercent}% {t('filled')}
            </p>
          </div>

          {/* Winners section for ended lotteries */}
          {status === 'ended' && winners && winners.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-default-400 uppercase tracking-wide">{t('winners')}</p>
              {winners.slice(0, 3).map(winner => (
                <div key={winner.id} className="flex items-center gap-2">
                  <Avatar src={winner.avatar} name={winner.username} size="sm" />
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
      </CardBody>

      <CardFooter className="pt-0">
        {status === 'active' && (
          <Button
            color="primary"
            fullWidth
            startContent={<Icon icon="solar:ticket-linear" width={16} />}
            onPress={() => onBuyTicket?.(id)}
          >
            {t('buyTicket')}
          </Button>
        )}
        {status === 'ended' && (
          <Button
            variant="flat"
            fullWidth
            startContent={<Icon icon="solar:trophy-linear" width={16} />}
            onPress={() => onViewWinners?.(id)}
          >
            {t('viewWinners')}
          </Button>
        )}
        {status === 'upcoming' && (
          <Chip color="warning" variant="flat" className="w-full justify-center py-2">
            <div className="flex items-center gap-1.5">
              <Icon icon="solar:clock-circle-linear" width={14} />
              <span>
                {t('starts')} {formatCountdown(drawDate, t('fromNow'))}
              </span>
            </div>
          </Chip>
        )}
      </CardFooter>
    </Card>
  );
};

export default LotteryCard;
