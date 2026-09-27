'use client';

import { Button, Chip, Label, NumberField, ProgressBar, ScrollShadow } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { splitDuration } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { useGuildPermissions } from '@/lib/permissions';
import { isNotFoundError } from '@/lib/guma/errors';
import { type FormatGold, formatPrize, useFormatGold } from '@/lib/guma/useFormatGold';
import { lotteryStatusColor } from '@/lib/status-colors';
import { useUserStore } from '@/lib/store';
import type { Lottery, LotteryWinner } from '@/types/lottery';
import { AsyncContent, DetailSkeleton } from './AsyncContent';
import { DateTimePicker } from './DateTimePicker';
import { LotteryWheel, type WheelEntry } from './LotteryWheel';
import { UserAvatar } from './UserAvatar';

const DRAW_RETRY_MS = 3000;

type DrawPhase = 'idle' | 'drawing' | 'spinning' | 'revealed';

function formatCountdown(ms: number, withDays: (days: number, clock: string) => string) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? withDays(days, clock) : clock;
}

function wheelEntries(
  lottery: Lottery,
  winners: LotteryWinner[],
  describe: (tickets: number, chance: string) => string,
  formatGold: FormatGold
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
      entries.push({ id: winner.username, label: winner.username, weight: 1, detail: formatPrize(winner.prize, winner.prizeAmount, formatGold) });
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
  const tCountdown = useTranslations('countdown');
  const formatGold = useFormatGold();
  const format = useIntlFormatter();
  const now = useNow(1000);
  const router = useRouter();
  const guildId = useCurrentGuildId();

  const [lottery, setLottery] = React.useState<Lottery | null>(null);
  const [isMissing, setIsMissing] = React.useState(false);
  const loadState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = React.useCallback(() => {
    loadState.reset();
    setReloadKey(key => key + 1);
  }, [loadState.reset]);
  const [quantity, setQuantity] = React.useState(1);
  const [isBuying, setIsBuying] = React.useState(false);
  const [phase, setPhase] = React.useState<DrawPhase>('idle');
  const [spinKey, setSpinKey] = React.useState(0);
  const [drawWinners, setDrawWinners] = React.useState<LotteryWinner[]>([]);
  const [isRescheduling, setIsRescheduling] = React.useState(false);
  const [rescheduleDate, setRescheduleDate] = React.useState('');
  const [rescheduleError, setRescheduleError] = React.useState('');
  const [isSavingSchedule, setIsSavingSchedule] = React.useState(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const changedDuringDraw = React.useRef(false);
  const lotteryRef = React.useRef(lottery);
  const phaseRef = React.useRef(phase);
  const currentUserId = useUserStore(state => state.user?.id);
  const { can } = useGuildPermissions();

  const load = React.useCallback(
    () =>
      apiClient
        .getLottery(guildId, id)
        .then(data => {
          setLottery(data);
          setIsMissing(false);
          loadState.ready();
          return data;
        })
        .catch(err => {
          if (isNotFoundError(err)) {
            setIsMissing(true);
          } else {
            loadState.failed();
            notify.loadFailed(reload, 'lottery-detail');
          }
          return null;
        }),
    [guildId, id, notify, reload, loadState.ready, loadState.failed]
  );

  React.useEffect(() => {
    load();
  }, [load, reloadKey]);

  React.useEffect(() => {
    lotteryRef.current = lottery;
    phaseRef.current = phase;
  });

  const startSpin = React.useCallback((winners: LotteryWinner[]) => {
    setDrawWinners(winners);
    setPhase('spinning');
    setSpinKey(key => key + 1);
  }, []);

  const refresh = React.useCallback(() => {
    const previousStatus = lotteryRef.current?.status;
    apiClient
      .getLottery(guildId, id)
      .then(data => {
        setLottery(data);
        setIsMissing(false);
        const winners = data.winners ?? [];
        if (previousStatus === 'active' && data.status === 'ended' && winners.length > 0 && phaseRef.current === 'idle') {
          startSpin(winners);
        }
      })
      .catch(err => {
        if (isNotFoundError(err)) setIsMissing(true);
        else notify.loadFailed(reload, 'lottery-detail');
      });
  }, [guildId, id, startSpin, notify, reload]);

  useLiveResource(
    ['lottery'],
    () => {
      if (phaseRef.current !== 'drawing') {
        refresh();
        return;
      }
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = undefined;
        setPhase('idle');
      } else {
        changedDuringDraw.current = true;
      }
    },
    { guildId, match: event => event.resourceId === id }
  );

  React.useEffect(() => () => clearTimeout(retryTimer.current), []);

  const drawTime = lottery ? new Date(lottery.drawDate).getTime() : 0;
  const isDue = !!lottery && lottery.status === 'active' && now >= drawTime;

  React.useEffect(() => {
    if (!isDue || phase !== 'idle') return;
    setPhase('drawing');
    changedDuringDraw.current = false;
    const retryLater = () => {
      const delay = changedDuringDraw.current ? 0 : DRAW_RETRY_MS;
      changedDuringDraw.current = false;
      retryTimer.current = setTimeout(() => {
        retryTimer.current = undefined;
        setPhase('idle');
      }, delay);
    };
    apiClient
      .getLotteryWinners(guildId, id)
      .then(async winners => {
        if (winners.length > 0) {
          startSpin(winners);
          return;
        }
        const latest = await load();
        if (latest?.status !== 'ended') retryLater();
        else if (latest.winners?.length) startSpin(latest.winners);
        else setPhase('revealed');
      })
      .catch(retryLater);
  }, [isDue, phase, guildId, id, load, startSpin]);

  const hasCap = (lottery?.maxTickets ?? 0) > 0;
  const ticketsLeft = lottery && hasCap ? Math.max(0, lottery.maxTickets - lottery.ticketsSold) : 0;
  React.useEffect(() => {
    if (ticketsLeft > 0) setQuantity(current => Math.min(current, ticketsLeft));
  }, [ticketsLeft]);

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
    return (
      <AsyncContent state={loadState.state} onRetry={reload} skeleton={<DetailSkeleton />}>
        {null}
      </AsyncContent>
    );
  }

  const winners = drawWinners.length > 0 ? drawWinners : (lottery.winners ?? []);
  const entries = wheelEntries(
    lottery,
    winners,
    (tickets, chance) => t('wheelDetail', { count: tickets, chance }),
    formatGold
  );
  const topWinner = winners[0]?.username;
  const participants = lottery.participants ?? [];
  const totalTickets = participants.reduce((sum, p) => sum + p.tickets, 0) || lottery.ticketsSold;
  const myTickets = participants.find(p => p.id === currentUserId)?.tickets ?? 0;
  const canReschedule = can('changeDrawDate') && lottery.status !== 'ended' && phase === 'idle' && !isDue;
  const soldPercent = hasCap ? Math.round((lottery.ticketsSold / lottery.maxTickets) * 100) : 0;
  const isOpen = lottery.status === 'active' && !isDue && phase === 'idle';
  const isSettled = lottery.status === 'ended' && (phase === 'idle' || phase === 'revealed');
  const showWinners = phase === 'revealed' || (phase === 'idle' && lottery.status === 'ended');

  const buy = async () => {
    setIsBuying(true);
    try {
      await apiClient.purchaseTickets(guildId, id, quantity);
      await load();
      setQuantity(1);
      notify.success(t('purchaseSuccess'));
    } catch {
      notify.error(t('purchaseFailed'));
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

  const startRescheduling = () => {
    setRescheduleDate(lottery.drawDate);
    setRescheduleError('');
    setIsRescheduling(true);
  };

  const saveSchedule = async () => {
    if (new Date(rescheduleDate).getTime() <= Date.now()) {
      setRescheduleError(t('drawDateInPast'));
      return;
    }
    setIsSavingSchedule(true);
    setRescheduleError('');
    try {
      await apiClient.updateLottery(guildId, id, { drawDate: rescheduleDate });
      await load();
      setIsRescheduling(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setRescheduleError(status === 403 ? t('rescheduleForbidden') : t('rescheduleFailed'));
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const wheelCaption = () => {
    if (phase === 'drawing') return t('drawing');
    if (phase === 'spinning') return t('spinning');
    if (showWinners && topWinner) return t('winnerIs', { name: topWinner });
    if (lottery.status === 'ended') return t('noWinners');
    if (lottery.status === 'upcoming') return t('notStarted');
    return t('drawsIn', {
      time: formatCountdown(drawTime - now, (days, clock) => tCountdown('daysClock', { days, clock })),
    });
  };

  const sectionClass = onClose ? '' : 'rounded-xl border border-divider p-4';

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
          <Chip size="sm" color={lotteryStatusColor[lottery.status]} variant="secondary" className="mb-1">
            {t(`status.${lottery.status}`)}
          </Chip>
          <h2 className="type-title text-foreground">{lottery.title}</h2>
        </div>
        <div className="text-right">
          <p className="type-caption text-hint">{t('prizePool')}</p>
          <p className="type-display text-foreground">{formatGold(lottery.prizePool)}</p>
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

        <div className={`flex flex-col ${onClose ? 'gap-6' : 'gap-4'}`}>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-divider p-3">
              <dt className="type-caption text-hint">{t('ticketPrice')}</dt>
              <dd className="type-subheading text-foreground tabular-nums">{formatGold(lottery.ticketPrice)}</dd>
            </div>
            <div className="flex items-start justify-between gap-2 rounded-xl border border-divider p-3">
              <div className="min-w-0">
                <dt className="type-caption text-hint">{t('drawDate')}</dt>
                <dd className="type-subheading text-foreground tabular-nums">
                  {format.dateTime(new Date(lottery.drawDate), {
                    year: new Date(lottery.drawDate).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              {canReschedule && !isRescheduling && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="text-hint shrink-0 -mr-1 -mt-1"
                  aria-label={t('reschedule')}
                  onPress={startRescheduling}
                >
                  <Icon icon="solar:pen-linear" width={16} />
                </Button>
              )}
            </div>
            {isRescheduling && canReschedule && (
              <div className="col-span-2 rounded-xl border border-divider p-3 space-y-3">
                <DateTimePicker
                  isRequired
                  label={t('newDrawDate')}
                  value={rescheduleDate}
                  onChange={value => {
                    setRescheduleDate(value);
                    setRescheduleError('');
                  }}
                  isInvalid={!!rescheduleError}
                  errorMessage={rescheduleError}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" onPress={() => setIsRescheduling(false)}>
                    {t('cancel')}
                  </Button>
                  <Button size="sm" isPending={isSavingSchedule} onPress={saveSchedule}>
                    {t('saveSchedule')}
                  </Button>
                </div>
              </div>
            )}
            <div className="col-span-2 rounded-xl border border-divider p-3 space-y-2">
              {hasCap ? (
                <>
                  <div className="flex justify-between type-caption text-hint">
                    <span>{t('ticketsSold', { sold: lottery.ticketsSold, max: lottery.maxTickets })}</span>
                    <span className="tabular-nums">{soldPercent}%</span>
                  </div>
                  <ProgressBar aria-label={t('ticketsSoldLabel')} value={soldPercent} color="accent" className="w-full">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </>
              ) : (
                <p className="type-caption text-hint">{t('ticketsSoldUncapped', { sold: lottery.ticketsSold })}</p>
              )}
            </div>
          </dl>

          {isOpen && (
            <section className={`space-y-3 ${sectionClass}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="type-subheading text-foreground">{t('buyTickets')}</h3>
                {myTickets > 0 && (
                  <span className="type-caption text-hint">
                    {t('yourTickets', { count: myTickets, chance: ((myTickets / totalTickets) * 100).toFixed(1) })}
                  </span>
                )}
              </div>
              {!hasCap || ticketsLeft > 0 ? (
                <div className="flex flex-wrap items-end gap-3">
                  <NumberField
                    minValue={1}
                    maxValue={hasCap ? ticketsLeft : undefined}
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
                    {t('purchase', { total: formatGold(quantity * lottery.ticketPrice) })}
                  </Button>
                </div>
              ) : (
                <p className="type-body text-subtle">{t('soldOut')}</p>
              )}
            </section>
          )}

          {showWinners && winners.length > 0 && (
            <section className={`space-y-2 ${sectionClass}`}>
              <h3 className="type-subheading text-foreground">{t('winners')}</h3>
              <ul className="flex flex-col gap-2">
                {winners.map(winner => (
                  <li key={winner.id} className="flex items-center gap-3">
                    <Icon icon="solar:cup-star-linear" width={18} className="text-warning shrink-0" />
                    <span className="type-body font-medium text-foreground flex-1 min-w-0 truncate">{winner.username}</span>
                    <span className="type-body text-success tabular-nums">{formatPrize(winner.prize, winner.prizeAmount, formatGold)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={onClose ? undefined : 'rounded-xl border border-divider'}>
            <div className={`flex items-center justify-between pb-2 ${onClose ? '' : 'px-4 pt-3'}`}>
              <h3 className="type-subheading text-foreground">{t('participants')}</h3>
              <span className="type-caption text-hint tabular-nums">{participants.length}</span>
            </div>
            {participants.length > 0 ? (
              <ScrollShadow className="max-h-80">
                <ul className={`flex flex-col ${onClose ? '' : 'px-2 pb-2'}`}>
                  {participants.map(p => (
                    <li key={p.id} className={`flex items-center gap-3 rounded-lg py-1.5 ${onClose ? '' : 'px-2'}`}>
                      <UserAvatar name={p.username} src={p.avatar} className="shrink-0" />
                      <span className="type-body text-foreground flex-1 min-w-0 truncate">{p.username}</span>
                      <span className="type-caption text-hint tabular-nums">
                        {t('ticketCount', { count: p.tickets })} · {((p.tickets / totalTickets) * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollShadow>
            ) : (
              <p className={`type-body text-subtle ${onClose ? '' : 'px-4 pb-4'}`}>{t('noParticipants')}</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
