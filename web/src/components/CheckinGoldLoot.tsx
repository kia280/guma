'use client';

import { Button, Chip, Label, Modal, NumberField, ProgressBar, Spinner, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import {
  DEFAULT_GOLD_WEIGHT,
  type GoldAmounts,
  type GoldWeights,
  WEIGHT_FORMAT_OPTIONS,
  newRequestId,
  splitRemainderByWeight,
  summarizeAllocation,
  toGoldPayouts,
  weightOf,
} from '@/lib/guma/gold-split';
import { GOLD_FORMAT_OPTIONS, GOLD_STEP } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { useGuildPermissions } from '@/lib/permissions';
import type { AttendanceMember, CheckinGoldPot } from '@/types/checkin';
import { GOLD_LOOT_ICON } from './LootListEditor';
import { UserAvatar } from './UserAvatar';

type LoadStatus = 'loading' | 'ready' | 'error';
type Step = 'edit' | 'review';
type AppliedSplit = { count: number; leftover: number };

type CheckinGoldLootProps = {
  checkinId: string;
  pot: CheckinGoldPot;
  attendees: AttendanceMember[];
  onPotChange: (pot: CheckinGoldPot) => void;
};

export function CheckinGoldLoot({ checkinId, pot, attendees, onPotChange }: CheckinGoldLootProps) {
  const t = useTranslations('checkinGold');
  const guildId = useCurrentGuildId();
  const notify = useToast();
  const format = useIntlFormatter();
  const userName = useUserName();
  const formatGold = useFormatGold();
  const { can } = useGuildPermissions();
  const modal = useOverlayState();

  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [received, setReceived] = React.useState<Record<string, number>>({});
  const [amounts, setAmounts] = React.useState<GoldAmounts>({});
  const [weights, setWeights] = React.useState<GoldWeights>({});
  const [step, setStep] = React.useState<Step>('edit');
  const [showErrors, setShowErrors] = React.useState(false);
  const [lastSplit, setLastSplit] = React.useState<AppliedSplit | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const requestId = React.useRef(newRequestId());
  const onPotChangeRef = React.useRef(onPotChange);
  React.useEffect(() => {
    onPotChangeRef.current = onPotChange;
  });

  const load = React.useCallback(() => {
    apiClient
      .getCheckinGold(guildId, checkinId)
      .then(summary => {
        setReceived(Object.fromEntries(summary.recipients.map(r => [r.userId, r.amount])));
        if (summary.pot) onPotChangeRef.current(summary.pot);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [guildId, checkinId]);

  React.useEffect(() => {
    load();
  }, [load]);

  useLiveResource(['bank'], load, { guildId });

  const eligible = attendees.filter((member): member is AttendanceMember & { userId: string } => !!member.userId);
  const nameOf = (userId: string) => userName(eligible.find(member => member.userId === userId)?.username);
  const isRetracted = pot.retracted > 0;
  const canDistribute = can('distributeLoot') && !isRetracted && pot.remaining > 0 && eligible.length > 0;

  const allocation = summarizeAllocation(pot.remaining, amounts);
  const payouts = toGoldPayouts(amounts);
  const split = splitRemainderByWeight(
    pot.remaining,
    amounts,
    weights,
    eligible.map(member => member.userId),
  );
  const formError = allocation.isOverAllocated
    ? t('errorOverAllocated', { remaining: formatGold(pot.remaining) })
    : showErrors && !allocation.hasPayout
      ? t('errorNoPayout')
      : null;

  const openModal = () => {
    setAmounts({});
    setWeights({});
    setStep('edit');
    setShowErrors(false);
    setLastSplit(null);
    setSubmitError(null);
    requestId.current = newRequestId();
    modal.open();
  };

  const setAmount = (userId: string, value: number) => {
    setAmounts(current => ({ ...current, [userId]: value }));
    setLastSplit(null);
  };

  const setWeight = (userId: string, value: number) => {
    setWeights(current => ({ ...current, [userId]: Number.isFinite(value) ? value : DEFAULT_GOLD_WEIGHT }));
    setLastSplit(null);
  };

  const applySplit = () => {
    if (!split) return;
    setAmounts(current => ({ ...current, ...split.shares }));
    setLastSplit({
      count: Object.values(split.shares).filter(share => share > 0).length,
      leftover: split.leftover,
    });
  };

  const clearAmounts = () => {
    setAmounts({});
    setLastSplit(null);
  };

  const goToReview = () => {
    setShowErrors(true);
    if (allocation.isOverAllocated || !allocation.hasPayout) return;
    setSubmitError(null);
    setStep('review');
  };

  const errorMessage = (err: unknown) => {
    switch (apiErrorCode(err)) {
      case GrpcCode.FailedPrecondition:
        return t('errorConflict');
      case GrpcCode.PermissionDenied:
        return t('errorForbidden');
      case GrpcCode.InvalidArgument:
        return t('errorInvalid');
      default:
        return t('errorFailed');
    }
  };

  const submit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const result = await apiClient.distributeCheckinGold(guildId, checkinId, requestId.current, payouts);
      onPotChange(result.pot);
      notify.success(t('success', { amount: formatGold(allocation.allocated), count: payouts.length }));
      modal.close();
      load();
    } catch (err) {
      const code = apiErrorCode(err);
      setSubmitError(errorMessage(err));
      if (code === GrpcCode.FailedPrecondition) {
        requestId.current = newRequestId();
        setStep('edit');
        load();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = pot.total > 0 ? Math.round((pot.distributed / pot.total) * 100) : 0;
  const summaryLine = isRetracted
    ? t('retractedSummary', { distributed: formatGold(pot.distributed), retracted: formatGold(pot.retracted) })
    : t('potSummary', { distributed: formatGold(pot.distributed), remaining: formatGold(pot.remaining) });

  return (
    <>
      <div className="flex flex-col gap-2 py-2.5 px-3 rounded-lg border border-divider bg-surface-secondary">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-warning/10 shrink-0">
            <Icon icon={GOLD_LOOT_ICON} width={16} className="text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="type-body font-medium text-foreground">
              {t('title')} <span className="tabular-nums">{formatGold(pot.total)}</span>
            </p>
            <p className="type-caption text-hint tabular-nums">{summaryLine}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 type-body">
            {status === 'loading' && <Spinner size="sm" aria-label={t('loading')} />}
            {!isRetracted && pot.remaining <= 0 && (
              <Chip size="sm" variant="secondary" color="success">
                {t('fullyDistributed')}
              </Chip>
            )}
            {isRetracted && (
              <Chip size="sm" variant="secondary">
                {t('retracted')}
              </Chip>
            )}
            {canDistribute && (
              <Button size="sm" variant="secondary" onPress={openModal}>
                <Icon icon="solar:hand-money-linear" width={16} />
                {t('distribute')}
              </Button>
            )}
          </div>
        </div>
        <ProgressBar aria-label={t('progressLabel')} value={progress} size="sm" color="warning">
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
        {status === 'error' && (
          <div role="alert" className="flex items-center justify-between gap-3">
            <p className="type-caption text-danger">{t('loadFailed')}</p>
            <Button size="sm" variant="tertiary" onPress={load}>
              {t('retry')}
            </Button>
          </div>
        )}
        {can('distributeLoot') && !isRetracted && pot.remaining > 0 && eligible.length === 0 && (
          <p className="type-caption text-hint">{t('noAttendees')}</p>
        )}
      </div>

      <Modal state={modal}>
        <Modal.Backdrop isDismissable={!isSubmitting}>
          <Modal.Container size="lg">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{step === 'edit' ? t('modalTitle') : t('reviewTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <dl className="grid grid-cols-3 gap-2 rounded-lg border border-divider p-3 type-body">
                  <div className="flex flex-col">
                    <dt className="type-caption text-hint">{t('potRemaining')}</dt>
                    <dd className="font-medium tabular-nums text-foreground">{formatGold(pot.remaining)}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="type-caption text-hint">{t('allocated')}</dt>
                    <dd
                      className={`font-medium tabular-nums ${allocation.isOverAllocated ? 'text-danger' : 'text-foreground'}`}
                    >
                      {formatGold(allocation.allocated)}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="type-caption text-hint">{t('unallocated')}</dt>
                    <dd
                      className={`font-medium tabular-nums ${allocation.isOverAllocated ? 'text-danger' : 'text-foreground'}`}
                    >
                      {formatGold(allocation.unallocated)}
                    </dd>
                  </div>
                </dl>

                {step === 'edit' ? (
                  <>
                    <p className="type-body text-soft">{t('modalDescription')}</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="secondary" isDisabled={!split} onPress={applySplit}>
                          <Icon icon="solar:pie-chart-2-linear" width={16} />
                          {t('splitByWeight')}
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          isDisabled={Object.keys(amounts).length === 0}
                          onPress={clearAmounts}
                        >
                          {t('clear')}
                        </Button>
                      </div>
                      <p className="type-caption text-hint">
                        {split
                          ? t('splitPreview', {
                              count: Object.keys(split.shares).length,
                              weight: format.number(split.totalWeight, WEIGHT_FORMAT_OPTIONS),
                              leftover: formatGold(split.leftover),
                              hasLeftover: split.leftover > 0 ? 'yes' : 'no',
                            })
                          : t('splitUnavailable')}
                      </p>
                      {lastSplit && (
                        <p role="status" className="type-caption text-success">
                          <span className="block">
                            {t('splitApplied', { count: lastSplit.count })}
                          </span>
                          {lastSplit.leftover > 0 && (
                            <span className="block">
                              {t('splitLeftover', { leftover: formatGold(lastSplit.leftover) })}
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    <p className="type-caption text-hint">{t('weightHint')}</p>
                    <div aria-hidden className="flex justify-end gap-2 type-label text-soft">
                      <span className="w-20 text-right">{t('weightColumn')}</span>
                      <span className="w-32 text-right">{t('amountColumn')}</span>
                    </div>
                    <ul aria-label={t('recipients')} className="-mt-2 flex flex-col divide-y divide-divider">
                      {eligible.map(member => (
                        <li key={member.userId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2">
                          <UserAvatar name={userName(member.username)} src={member.avatar} className="size-8 shrink-0" />
                          <div className="flex-1 min-w-[7rem]">
                            <p className="type-body font-medium text-foreground truncate">{userName(member.username)}</p>
                            {(received[member.userId] ?? 0) > 0 && (
                              <p className="type-caption text-hint tabular-nums">
                                {t('receivedSoFar', { amount: formatGold(received[member.userId]) })}
                              </p>
                            )}
                          </div>
                          <div className="ml-auto flex shrink-0 gap-2">
                            <NumberField
                              aria-label={t('weightFor', { name: userName(member.username) })}
                              className="w-20"
                              formatOptions={WEIGHT_FORMAT_OPTIONS}
                              minValue={0}
                              step={0.5}
                              value={weightOf(weights, member.userId)}
                              onChange={value => setWeight(member.userId, value)}
                            >
                              <Label className="sr-only">{t('weightFor', { name: userName(member.username) })}</Label>
                              <NumberField.Group>
                                <NumberField.Input className="w-full min-w-0 text-right" />
                              </NumberField.Group>
                            </NumberField>
                            <NumberField
                              aria-label={t('amountFor', { name: userName(member.username) })}
                              className="w-32"
                              validationBehavior="aria"
                              isInvalid={allocation.isOverAllocated && (amounts[member.userId] ?? 0) > 0}
                              formatOptions={GOLD_FORMAT_OPTIONS}
                              minValue={0}
                              step={GOLD_STEP}
                              value={amounts[member.userId] ?? Number.NaN}
                              onChange={value => setAmount(member.userId, Number.isFinite(value) ? value : Number.NaN)}
                            >
                              <Label className="sr-only">{t('amountFor', { name: userName(member.username) })}</Label>
                              <NumberField.Group>
                                <NumberField.Input className="w-full min-w-0 text-right" placeholder="0.00" />
                              </NumberField.Group>
                            </NumberField>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="type-caption text-hint">{t('leftoverStays')}</p>
                  </>
                ) : (
                  <>
                    <p className="type-body text-soft">{t('reviewDescription', { count: payouts.length })}</p>
                    <ul aria-label={t('recipients')} className="flex flex-col divide-y divide-divider">
                      {payouts.map(payout => (
                        <li key={payout.userId} className="flex items-center justify-between gap-3 py-2 type-body">
                          <span className="min-w-0 truncate text-foreground">{nameOf(payout.userId)}</span>
                          <span className="font-medium tabular-nums text-foreground">{formatGold(payout.amount)}</span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-3 py-2 type-body">
                        <span className="font-medium text-foreground">{t('total')}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatGold(allocation.allocated)}
                        </span>
                      </li>
                    </ul>
                    {allocation.unallocated > 0 && (
                      <p className="type-caption text-hint">
                        {t('reviewLeftover', { amount: formatGold(allocation.unallocated) })}
                      </p>
                    )}
                  </>
                )}

                {(formError || submitError) && (
                  <p role="alert" className="type-caption text-danger">
                    {submitError ?? formError}
                  </p>
                )}
              </Modal.Body>
              <Modal.Footer>
                {step === 'edit' ? (
                  <>
                    <Button slot="close" variant="secondary">
                      {t('cancel')}
                    </Button>
                    <Button variant="primary" onPress={goToReview}>
                      {t('review')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" isDisabled={isSubmitting} onPress={() => setStep('edit')}>
                      {t('back')}
                    </Button>
                    <Button variant="primary" isPending={isSubmitting} onPress={submit}>
                      {t('confirm')}
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
