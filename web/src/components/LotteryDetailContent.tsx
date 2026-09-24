'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { Avatar, Button, Chip, Label, NumberField, ProgressBar, ScrollShadow } from '@heroui/react';
import { Icon } from '@iconify/react';

import { LotteryWheel, type WheelEntry } from './LotteryWheel';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import type { Lottery, LotteryStatus, LotteryWinner } from '@/types/lottery';

const CURRENT_USER_ID = 'current-user';

type DrawPhase = 'idle' | 'drawing' | 'spinning' | 'revealed';

const STATUS_COLOR: Record<LotteryStatus, 'accent' | 'warning' | 'default'> = {
  active: 'accent',
  upcoming: 'warning',
  ended: 'default',
};

function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60,
  };
}

function formatCountdown(ms: number) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function wheelEntries(
  lottery: Lottery,
  winners: LotteryWinner[],
  describe: (tickets: number, chance: string) => string
): WheelEntry[] {
  const participants = lottery.participants ?? [];
  const total = participants.reduce((sum, p) => sum + p.tickets, 0) || 1;
  const entries = participants.map(p => ({
    id: p.username,
    label: p.username,
    weight: p.tickets,
    detail: describe(p.tickets, ((p.tickets / total) * 100).toFixed(1)),
  }));
  for (const winner of winners) {
    if (!entries.some(entry => entry.id === winner.username)) {
      entries.push({ id: winner.username, label: winner.username, weight: 1, detail: winner.prize });
    }
  }
  return entries;
}

type LotteryDetailContentProps = {
  id: string;
  onClose?: () => void;
};

export default function LotteryDetailContent({ id, onClose }: LotteryDetailContentProps) {
  const t = useTranslations('lotteryDetail');
  const format = useFormatter();
  const router = useRouter();
  const guildId = useCurrentGuildId();

  const [lottery, setLottery] = React.useState<Lottery | null>(null);
  const [isMissing, setIsMissing] = React.useState(false);
  const [now, setNow] = React.useState(() => Date.now());
  const [quantity, setQuantity] = React.useState(1);
  const [isBuying, setIsBuying] = React.useState(false);
  const [phase, setPhase] = React.useState<DrawPhase>('idle');
  const [spinKey, setSpinKey] = React.useState(0);
  const [drawWinners, setDrawWinners] = React.useState<LotteryWinner[]>([]);

  const load = React.useCallback(
    () =>
      apiClient
        .getLottery(guildId, id)
        .then(data => {
          setLottery(data);
          setIsMissing(false);
          return data;
        })
        .catch(() => {
          setIsMissing(true);
          return null;
        }),
    [guildId, id]
  );

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const drawTime = lottery ? new Date(lottery.drawDate).getTime() : 0;
  const isDue = !!lottery && lottery.status === 'active' && now >= drawTime;

  React.useEffect(() => {
    if (!isDue || phase !== 'idle') return;
    setPhase('drawing');
    apiClient
      .getLotteryWinners(guildId, id)
      .then(winners => {
        setDrawWinners(winners);
        if (winners.length === 0) {
          setPhase('revealed');
          load();
          return;
        }
        setPhase('spinning');
        setSpinKey(key => key + 1);
      })
      .catch(() => setPhase('idle'));
  }, [isDue, phase, guildId, id, load]);

  if (isMissing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Icon icon="solar:ghost-linear" width={48} className="text-disabled" />
        <p className="type-body text-subtle">{t('notFound')}</p>
        <Button variant="secondary" onPress={() => (onClose ? onClose() : router.back())}>
          {t('goBack')}
        </Button>
      </div>
    );
  }

  if (!lottery) {
    return <div className="py-24" aria-busy="true" />;
  }

  const winners = drawWinners.length > 0 ? drawWinners : (lottery.winners ?? []);
  const entries = wheelEntries(lottery, winners, (tickets, chance) =>
    t('wheelDetail', { count: tickets, chance })
  );
  const topWinner = winners[0]?.username;
  const participants = lottery.participants ?? [];
  const totalTickets = participants.reduce((sum, p) => sum + p.tickets, 0) || lottery.ticketsSold;
  const myTickets = participants.find(p => p.id === CURRENT_USER_ID)?.tickets ?? 0;
  const ticketsLeft = Math.max(0, lottery.maxTickets - lottery.ticketsSold);
  const soldPercent = Math.round((lottery.ticketsSold / lottery.maxTickets) * 100);
  const isOpen = lottery.status === 'active' && !isDue && phase === 'idle';
  const isSettled = lottery.status === 'ended' && (phase === 'idle' || phase === 'revealed');
  const showWinners = phase === 'revealed' || (phase === 'idle' && lottery.status === 'ended');

  const buy = async () => {
    setIsBuying(true);
    try {
      await apiClient.purchaseTickets(guildId, id, quantity);
      await load();
      setQuantity(1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsBuying(false);
    }
  };

  const replay = () => {
    setPhase('spinning');
    setSpinKey(key => key + 1);
  };

  const finishSpin = () => {
    setPhase('revealed');
    load();
  };

  const wheelCaption = () => {
    if (phase === 'drawing') return t('drawing');
    if (phase === 'spinning') return t('spinning');
    if (showWinners && topWinner) return t('winnerIs', { name: topWinner });
    if (lottery.status === 'upcoming') return t('notStarted');
    return t('drawsIn', { time: formatCountdown(drawTime - now) });
  };

  return (
    <div className="flex flex-col gap-5">
      {!onClose && (
        <Button variant="secondary" size="sm" className="w-fit" onPress={() => router.push('/dashboard/lottery')}>
          <Icon icon="solar:arrow-left-linear" width={16} />
          {t('backToLotteries')}
        </Button>
      )}

      <div className={`flex flex-wrap items-start justify-between gap-3 ${onClose ? 'pr-8' : ''}`}>
        <div className="min-w-0">
          <Chip size="sm" color={STATUS_COLOR[lottery.status]} variant="secondary" className="mb-1">
            {t(`status.${lottery.status}`)}
          </Chip>
          <h2 className="type-title text-foreground">{lottery.title}</h2>
        </div>
        <div className="text-right">
          <p className="type-caption text-hint">{t('prizePool')}</p>
          <p className="type-display text-foreground">${lottery.prizePool.toLocaleString('en-US')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] gap-5">
        <section className="flex flex-col items-center justify-center gap-4 rounded-xl border border-divider bg-surface-secondary p-4 sm:p-6">
          <LotteryWheel
            entries={entries}
            winnerId={topWinner}
            spinKey={spinKey}
            isRevealed={phase === 'revealed' || (phase === 'idle' && lottery.status === 'ended')}
            onSpinEnd={finishSpin}
          />
          <p className="type-subheading text-foreground tabular-nums text-center" aria-live={phase === 'idle' ? 'off' : 'polite'}>
            {wheelCaption()}
          </p>
          {isSettled && winners.length > 0 && (
            <Button size="sm" variant="ghost" onPress={replay}>
              <Icon icon="solar:restart-linear" width={16} />
              {t('replay')}
            </Button>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-divider p-3">
              <dt className="type-caption text-hint">{t('ticketPrice')}</dt>
              <dd className="type-subheading text-foreground tabular-nums">${lottery.ticketPrice.toLocaleString('en-US')}</dd>
            </div>
            <div className="rounded-xl border border-divider p-3">
              <dt className="type-caption text-hint">{t('drawDate')}</dt>
              <dd className="type-subheading text-foreground tabular-nums">
                {format.dateTime(new Date(lottery.drawDate), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </dd>
            </div>
            <div className="col-span-2 rounded-xl border border-divider p-3 space-y-2">
              <div className="flex justify-between type-caption text-hint">
                <span>{t('ticketsSold', { sold: lottery.ticketsSold, max: lottery.maxTickets })}</span>
                <span className="tabular-nums">{soldPercent}%</span>
              </div>
              <ProgressBar aria-label={t('ticketsSoldLabel')} value={soldPercent} color="accent" className="w-full">
                <ProgressBar.Track>
                  <ProgressBar.Fill />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          </dl>

          {isOpen && (
            <section className="rounded-xl border border-divider p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="type-subheading text-foreground">{t('buyTickets')}</h3>
                {myTickets > 0 && (
                  <span className="type-caption text-hint">
                    {t('yourTickets', { count: myTickets, chance: ((myTickets / totalTickets) * 100).toFixed(1) })}
                  </span>
                )}
              </div>
              {ticketsLeft > 0 ? (
                <div className="flex flex-wrap items-end gap-3">
                  <NumberField
                    minValue={1}
                    maxValue={ticketsLeft}
                    value={quantity}
                    onChange={value => setQuantity(Number.isFinite(value) ? value : 1)}
                  >
                    <Label>{t('quantity')}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-16 text-center" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <Button className="flex-1 min-w-40" isPending={isBuying} onPress={buy}>
                    <Icon icon="solar:ticket-linear" width={16} />
                    {t('purchase', { total: `$${(quantity * lottery.ticketPrice).toLocaleString('en-US')}` })}
                  </Button>
                </div>
              ) : (
                <p className="type-body text-subtle">{t('soldOut')}</p>
              )}
            </section>
          )}

          {showWinners && winners.length > 0 && (
            <section className="rounded-xl border border-divider p-4 space-y-2">
              <h3 className="type-subheading text-foreground">{t('winners')}</h3>
              <ul className="flex flex-col gap-2">
                {winners.map(winner => (
                  <li key={winner.id} className="flex items-center gap-3">
                    <Icon icon="solar:cup-star-linear" width={18} className="text-warning shrink-0" />
                    <span className="type-body font-medium text-foreground flex-1 min-w-0 truncate">{winner.username}</span>
                    <span className="type-body text-success tabular-nums">{winner.prize}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-divider">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <h3 className="type-subheading text-foreground">{t('participants')}</h3>
              <span className="type-caption text-hint tabular-nums">{participants.length}</span>
            </div>
            {participants.length > 0 ? (
              <ScrollShadow className="max-h-80">
                <ul className="flex flex-col px-2 pb-2">
                  {participants.map(p => (
                    <li key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <Avatar size="sm" className="shrink-0">
                        <Avatar.Fallback>{Array.from(p.username).slice(0, 2).join('')}</Avatar.Fallback>
                      </Avatar>
                      <span className="type-body text-foreground flex-1 min-w-0 truncate">{p.username}</span>
                      <span className="type-caption text-hint tabular-nums">
                        {t('ticketCount', { count: p.tickets })} · {((p.tickets / totalTickets) * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollShadow>
            ) : (
              <p className="type-body text-subtle px-4 pb-4">{t('noParticipants')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
