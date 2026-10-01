'use client';

import { Button, Chip, Label, NumberField, ProgressBar, ScrollShadow, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { splitDuration } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode, isNotFoundError } from '@/lib/guma/errors';
import { type FormatGold, formatPrize, prizeItemNames, useFormatGold } from '@/lib/guma/useFormatGold';
import { emitLiveEvent } from '@/lib/live-events';
import { useGuildPermissions } from '@/lib/permissions';
import { raffleStatusColor } from '@/lib/status-colors';
import { useUserStore } from '@/lib/store';
import type { Raffle, RaffleWinner } from '@/types/raffle';
import { AsyncContent, DetailSkeleton, EmptyContent } from './AsyncContent';
import { ConfirmDialog } from './ConfirmDialog';
import { RaffleEditModal } from './RaffleEditModal';
import { RaffleWheel, type WheelEntry } from './RaffleWheel';
import { UserAvatar } from './UserAvatar';

const DRAW_RETRY_MS = 3000;
const DESCRIPTION_PREVIEW_LENGTH = 240;

type DrawPhase = 'idle' | 'drawing' | 'spinning' | 'revealed';

function formatCountdown(ms: number, withDays: (days: number, clock: string) => string) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? withDays(days, clock) : clock;
}

const winnerEntryId = (winner: RaffleWinner) => winner.userId ?? winner.id;

function wheelEntries(
  raffle: Raffle,
  winners: RaffleWinner[],
  describe: (tickets: number, chance: string) => string,
  formatGold: FormatGold,
  userName: (name: string) => string
): WheelEntry[] {
  const participants = raffle.participants ?? [];
  const total = participants.reduce((sum, p) => sum + p.tickets, 0) || 1;
  const entries = participants.map(p => ({
    id: p.id,
    label: userName(p.username),
    weight: p.tickets,
    detail: describe(p.tickets, ((p.tickets / total) * 100).toFixed(1)),
  }));
  for (const winner of winners) {
    const winnerKey = winnerEntryId(winner);
    if (!entries.some(entry => entry.id === winnerKey)) {
      entries.push({ id: winnerKey, label: userName(winner.username), weight: 1, detail: formatPrize(winner.prize, winner.prizeAmount, formatGold) });
    }
  }
  return entries;
}

type RaffleDetailContentProps = {
  id: string;
  onClose?: () => void;
};

export default function RaffleDetailContent({ id, onClose }: RaffleDetailContentProps) {
  const t = useTranslations('raffleDetail');
  const tCountdown = useTranslations('countdown');
  const userName = useUserName();
  const formatGold = useFormatGold();
  const format = useIntlFormatter();
  const now = useNow(1000);
  const router = useRouter();
  const guildId = useCurrentGuildId();

  const [raffle, setRaffle] = React.useState<Raffle | null>(null);
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
  const [drawWinners, setDrawWinners] = React.useState<RaffleWinner[]>([]);
  const editModal = useOverlayState();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = React.useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = React.useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const retryTimer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const changedDuringDraw = React.useRef(false);
  const raffleRef = React.useRef(raffle);
  const phaseRef = React.useRef(phase);
  const currentUserId = useUserStore(state => state.user?.id);
  const { can } = useGuildPermissions();
  const { balance, isLoaded: isBalanceLoaded } = useWalletBalance();
  const refreshMe = useUserStore(state => state.refreshMe);
  const purchaseBlockedReasonId = React.useId();
  const descriptionId = React.useId();

  const load = React.useCallback(
    () =>
      apiClient
        .getRaffle(guildId, id)
        .then(data => {
          setRaffle(data);
          setIsMissing(false);
          loadState.ready();
          return data;
        })
        .catch(err => {
          if (isNotFoundError(err)) {
            setIsMissing(true);
          } else {
            loadState.failed();
            notify.loadFailed(reload, 'raffle-detail');
          }
          return null;
        }),
    [guildId, id, notify, reload, loadState.ready, loadState.failed]
  );

  React.useEffect(() => {
    load();
  }, [load, reloadKey]);

  React.useEffect(() => {
    raffleRef.current = raffle;
    phaseRef.current = phase;
  });

  const startSpin = React.useCallback((winners: RaffleWinner[]) => {
    setDrawWinners(winners);
    setPhase('spinning');
    setSpinKey(key => key + 1);
  }, []);

  const refresh = React.useCallback(() => {
    const previousStatus = raffleRef.current?.status;
    apiClient
      .getRaffle(guildId, id)
      .then(data => {
        setRaffle(data);
        setIsMissing(false);
        const winners = data.winners ?? [];
        if (previousStatus === 'active' && data.status === 'ended' && winners.length > 0 && phaseRef.current === 'idle') {
          startSpin(winners);
        }
      })
      .catch(err => {
        if (isNotFoundError(err)) setIsMissing(true);
        else notify.loadFailed(reload, 'raffle-detail');
      });
  }, [guildId, id, startSpin, notify, reload]);

  useLiveResource(
    ['raffle'],
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

  const drawTime = raffle ? new Date(raffle.drawDate).getTime() : 0;
  const isDue = !!raffle && raffle.status === 'active' && now >= drawTime;

  if (isDue && phase === 'idle') setPhase('drawing');

  React.useEffect(() => {
    if (phase !== 'drawing') return;
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
      .getRaffleWinners(guildId, id)
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
  }, [phase, guildId, id, load, startSpin]);

  const hasCap = (raffle?.maxTickets ?? 0) > 0;
  const ticketsLeft = raffle && hasCap ? Math.max(0, raffle.maxTickets - raffle.ticketsSold) : 0;
  if (ticketsLeft > 0 && quantity > ticketsLeft) setQuantity(ticketsLeft);

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

  if (!raffle) {
    return (
      <AsyncContent state={loadState.state} onRetry={reload} skeleton={<DetailSkeleton />}>
        {null}
      </AsyncContent>
    );
  }

  const winners = drawWinners.length > 0 ? drawWinners : (raffle.winners ?? []);
  const entries = wheelEntries(
    raffle,
    winners,
    (tickets, chance) => t('wheelDetail', { count: tickets, chance }),
    formatGold,
    userName
  );
  const topWinner = winners[0];
  const participants = raffle.participants ?? [];
  const totalTickets = participants.reduce((sum, p) => sum + p.tickets, 0) || raffle.ticketsSold;
  const myTickets = participants.find(p => p.id === currentUserId)?.tickets ?? 0;
  const isUndrawn = (raffle.status === 'active' || raffle.status === 'upcoming') && phase === 'idle' && !isDue;
  const canEdit = can('editRaffle') && isUndrawn;
  const canCancel = can('cancelRaffle') && isUndrawn;
  const isCancelled = raffle.status === 'cancelled';
  const canDelete = can('deleteRaffle') && isCancelled;
  const soldPercent = hasCap ? Math.round((raffle.ticketsSold / raffle.maxTickets) * 100) : 0;
  const isOpen = raffle.status === 'active' && !isDue && phase === 'idle';
  const isSettled = raffle.status === 'ended' && (phase === 'idle' || phase === 'revealed');
  const showWinners = phase === 'revealed' || (phase === 'idle' && raffle.status === 'ended');

  const purchaseTotal = quantity * raffle.ticketPrice;
  const exceedsBalance = isBalanceLoaded && purchaseTotal > balance;

  const purchaseErrorMessage = async (err: unknown, requested: number) => {
    const code = apiErrorCode(err);
    if (!isNotFoundError(err) && code !== GrpcCode.FailedPrecondition) return t('purchaseFailed');
    const [latest] = await Promise.all([load(), refreshMe()]);
    if (!latest || (latest.status !== 'active' && latest.status !== 'upcoming')) return t('purchaseClosed');
    if (latest.maxTickets > 0 && latest.ticketsSold + requested > latest.maxTickets) {
      return t('purchaseSoldOut', { count: Math.max(0, latest.maxTickets - latest.ticketsSold) });
    }
    const latestBalance = useUserStore.getState().user?.balance;
    if (latestBalance != null && requested * latest.ticketPrice > latestBalance) return t('insufficientBalance');
    return t('purchaseFailed');
  };

  const buy = async () => {
    if (exceedsBalance) return;
    const requested = quantity;
    setIsBuying(true);
    try {
      await apiClient.purchaseTickets(guildId, id, requested);
      await load();
      setQuantity(1);
      notify.success(t('purchaseSuccess'));
    } catch (err) {
      notify.error(await purchaseErrorMessage(err, requested));
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

  const announceChange = () => {
    emitLiveEvent({ kind: 'resource', guildId, resource: 'raffle', resourceId: id });
  };

  const handleEditSaved = (updated: Raffle) => {
    setRaffle(current => (current ? { ...updated, participants: current.participants } : updated));
    load();
    announceChange();
  };

  const handleEditRejected = () => {
    load();
    announceChange();
  };

  const handleCancelConfirm = async () => {
    try {
      await apiClient.cancelRaffle(guildId, id);
    } finally {
      load();
      refreshMe();
      announceChange();
    }
  };

  const handleDeleteConfirm = async () => {
    await apiClient.deleteRaffle(guildId, id);
    announceChange();
    notify.success(t('deleted'));
    if (onClose) onClose();
    else router.push('/dashboard/raffle');
  };

  const wheelCaption = () => {
    if (phase === 'drawing') return t('drawing');
    if (phase === 'spinning') return t('spinning');
    if (showWinners && topWinner) return t('winnerIs', { name: userName(topWinner.username) });
    if (raffle.status === 'ended') return t('noWinners');
    if (isCancelled) return t('cancelledCaption');
    if (raffle.status === 'upcoming') return t('notStarted');
    return t('drawsIn', {
      time: formatCountdown(drawTime - now, (days, clock) => tCountdown('daysClock', { days, clock })),
    });
  };

  const itemPrizes = format.list(prizeItemNames(raffle.prizes, formatGold));
  const rankedPrizes = [...(raffle.prizes ?? [])].sort((a, b) => a.rank - b.rank);
  const showPrizeList = rankedPrizes.length > 1;
  const isLongDescription = (raffle.description?.length ?? 0) > DESCRIPTION_PREVIEW_LENGTH;

  const sectionClass = onClose ? '' : 'rounded-xl border border-divider p-4';
  const stackGap = onClose ? 'gap-y-6' : 'gap-y-4';

  return (
    <div className="flex flex-col gap-5">
      <div className={`flex flex-wrap items-start justify-between gap-3 ${onClose ? 'pr-8' : ''}`}>
        <div className="min-w-0 type-body">
          <Chip size="sm" color={raffleStatusColor[raffle.status]} variant="secondary" className="mb-1">
            {t(`status.${raffle.status}`)}
          </Chip>
          <h2 className="type-title text-foreground wrap-break-word">{raffle.title}</h2>
        </div>
        <div className="min-w-0 sm:text-right">
          {itemPrizes && raffle.prizePool <= 0 ? (
            <>
              <p className="type-caption text-hint">{t('prize')}</p>
              <p className="type-heading text-foreground wrap-break-word">{itemPrizes}</p>
            </>
          ) : (
            <>
              <p className="type-caption text-hint">{t('prizePool')}</p>
              <p className="type-display text-foreground">{formatGold(raffle.prizePool)}</p>
              {itemPrizes && <p className="type-body text-subtle wrap-break-word">{t('plusItems', { items: itemPrizes })}</p>}
            </>
          )}
        </div>
        {raffle.description && (
          <div className="w-full type-body">
            <p
              id={descriptionId}
              className={`text-subtle whitespace-pre-line wrap-break-word ${isLongDescription && !isDescriptionExpanded ? 'line-clamp-3' : ''}`}
            >
              {raffle.description}
            </p>
            {isLongDescription && (
              <Button
                size="sm"
                variant="ghost"
                className="-ml-2 mt-1 max-sm:h-11"
                aria-expanded={isDescriptionExpanded}
                aria-controls={descriptionId}
                onPress={() => setIsDescriptionExpanded(expanded => !expanded)}
              >
                {isDescriptionExpanded ? t('showLess') : t('showMore')}
              </Button>
            )}
          </div>
        )}
      </div>

      {(canEdit || canCancel || canDelete) && (
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="secondary" className="max-sm:h-11" onPress={editModal.open}>
              <Icon icon="solar:pen-linear" width={16} />
              {t('editRaffle')}
            </Button>
          )}
          {canCancel && (
            <Button variant="danger-soft" className="max-sm:h-11" onPress={() => setIsCancelConfirmOpen(true)}>
              <Icon icon="solar:forbidden-circle-linear" width={16} />
              {t('cancelRaffle')}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger-soft" className="max-sm:h-11" onPress={() => setIsDeleteConfirmOpen(true)}>
              <Icon icon="solar:trash-bin-trash-linear" width={16} />
              {t('deleteRaffle')}
            </Button>
          )}
        </div>
      )}

      {isCancelled && (
        <div className="flex items-start gap-3 rounded-xl border border-divider bg-surface-secondary p-4">
          <Icon icon="solar:forbidden-circle-linear" width={20} className="text-subtle shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <p className="type-body font-medium text-foreground">
              {raffle.cancelledAt
                ? t('cancelledBanner', {
                    date: format.dateTime(new Date(raffle.cancelledAt), { dateStyle: 'medium', timeStyle: 'short' }),
                  })
                : t('cancelledBannerNoDate')}
            </p>
            <p className="type-caption text-subtle">{t('cancelledBannerDetail')}</p>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr] gap-x-5 ${stackGap}`}>
        <div className={`lg:col-start-2 lg:row-start-1 flex flex-col ${stackGap}`}>
          {showWinners && winners.length > 0 && (
            <section className={`space-y-2 ${sectionClass}`}>
              <h3 className="type-subheading text-foreground">{t('winners')}</h3>
              <ul className="flex flex-col gap-2">
                {winners.map(winner => (
                  <li key={winner.id} className="flex items-center gap-3">
                    <Icon icon="solar:cup-star-linear" width={18} className="text-warning shrink-0" />
                    <span className="type-body font-medium text-foreground flex-1 min-w-0 truncate">{userName(winner.username)}</span>
                    <span className="type-body text-success tabular-nums">{formatPrize(winner.prize, winner.prizeAmount, formatGold)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showPrizeList && (
            <section className={`space-y-2 ${sectionClass}`}>
              <h3 className="type-subheading text-foreground">{t('prizes')}</h3>
              <ol className="flex flex-col gap-2">
                {rankedPrizes.map(prize => (
                  <li key={prize.rank} className="flex items-baseline gap-3 type-body">
                    <span className="type-caption text-hint shrink-0">{t('prizeRank', { rank: prize.rank })}</span>
                    <span className="flex-1 min-w-0 text-foreground wrap-break-word">
                      {formatPrize(prize.itemName ?? prize.description, prize.amount, formatGold)}
                    </span>
                    {prize.amount !== undefined && prize.amount > 0 && (prize.itemName ?? prize.description) !== formatGold(prize.amount) && (
                      <span className="text-foreground tabular-nums">{formatGold(prize.amount)}</span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-divider p-3">
              <dt className="type-caption text-hint">{t('ticketPrice')}</dt>
              <dd className="type-subheading text-foreground tabular-nums">{formatGold(raffle.ticketPrice)}</dd>
            </div>
            <div className="flex items-start justify-between gap-2 rounded-xl border border-divider p-3">
              <div className="min-w-0">
                <dt className="type-caption text-hint">{t('drawDate')}</dt>
                <dd className="type-subheading text-foreground tabular-nums">
                  {format.dateTime(new Date(raffle.drawDate), {
                    year: new Date(raffle.drawDate).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
              {canEdit && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="text-hint shrink-0 -mr-1 -mt-1"
                  aria-label={t('reschedule')}
                  onPress={editModal.open}
                >
                  <Icon icon="solar:pen-linear" width={16} />
                </Button>
              )}
            </div>
            <div className="col-span-2 rounded-xl border border-divider p-3 space-y-2">
              {hasCap ? (
                <>
                  <div className="flex justify-between type-caption text-hint">
                    <span>{t('ticketsSold', { sold: raffle.ticketsSold, max: raffle.maxTickets })}</span>
                    <span className="tabular-nums">{soldPercent}%</span>
                  </div>
                  <ProgressBar aria-label={t('ticketsSoldLabel')} value={soldPercent} color="accent" className="w-full">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </>
              ) : (
                <p className="type-caption text-hint">{t('ticketsSoldUncapped', { sold: raffle.ticketsSold })}</p>
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
                  <Button
                    className="flex-1 min-w-40"
                    isPending={isBuying}
                    isDisabled={exceedsBalance}
                    aria-describedby={exceedsBalance ? purchaseBlockedReasonId : undefined}
                    onPress={buy}
                  >
                    <Icon icon="solar:ticket-linear" width={16} />
                    {t('purchase', { total: formatGold(purchaseTotal) })}
                  </Button>
                  <div className="w-full space-y-1">
                    <p className="type-caption text-hint tabular-nums">
                      {t('yourBalance', { amount: isBalanceLoaded ? formatGold(balance) : '—' })}
                    </p>
                    {exceedsBalance && (
                      <p id={purchaseBlockedReasonId} className="type-caption text-danger">
                        {t('insufficientBalance')}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="type-body text-subtle">{t('soldOut')}</p>
              )}
            </section>
          )}

        </div>

        <section
          className={`lg:col-start-1 lg:row-start-1 lg:row-span-2 flex flex-col items-center justify-center gap-4 rounded-xl border border-divider bg-surface-secondary p-4 sm:p-6 ${entries.length === 0 ? 'lg:self-start' : ''}`}
        >
          {entries.length > 0 ? (
            <RaffleWheel
              entries={entries}
              winnerId={topWinner && winnerEntryId(topWinner)}
              spinKey={spinKey}
              isRevealed={phase === 'revealed' || (phase === 'idle' && raffle.status === 'ended')}
              onSpinEnd={finishSpin}
              label={t('wheelLabel', { count: entries.length })}
            />
          ) : (
            <Icon icon="solar:ticket-linear" width={40} className="text-hint" aria-hidden />
          )}
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

        <div className={`lg:col-start-2 lg:row-start-2 flex flex-col ${stackGap}`}>
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
                      <UserAvatar name={userName(p.username)} src={p.avatar} className="shrink-0" />
                      <span className="type-body text-foreground flex-1 min-w-0 truncate">{userName(p.username)}</span>
                      <span className="type-caption text-hint tabular-nums">
                        {t('ticketCount', { count: p.tickets })} · {((p.tickets / totalTickets) * 100).toFixed(1)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </ScrollShadow>
            ) : (
              <EmptyContent icon="solar:users-group-rounded-linear" title={t('noParticipants')} />
            )}
          </section>
        </div>
      </div>

      {canEdit && (
        <RaffleEditModal raffle={raffle} state={editModal} onSaved={handleEditSaved} onRejected={handleEditRejected} />
      )}

      <ConfirmDialog
        heading={t('cancelConfirmTitle')}
        body={t('cancelConfirmBody', { sold: raffle.ticketsSold })}
        confirmLabel={t('cancelConfirm')}
        failedMessage={t('cancelFailed')}
        isOpen={isCancelConfirmOpen}
        onOpenChange={setIsCancelConfirmOpen}
        onConfirm={handleCancelConfirm}
        success={{ title: t('cancelSuccess'), detail: t('cancelSuccessDetail') }}
      />

      <ConfirmDialog
        heading={t('deleteConfirmTitle')}
        body={t('deleteConfirmBody')}
        confirmLabel={t('deleteConfirm')}
        failedMessage={t('deleteFailed')}
        isOpen={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
