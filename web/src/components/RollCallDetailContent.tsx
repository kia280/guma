'use client';

import { Button, Chip, Separator, Modal, Spinner, TextArea, TextField, Label, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useId } from 'react';
import { useLoadState } from '@/hooks/useLoadState';
import { useCountdown } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { emitLiveEvent } from '@/lib/live-events';
import { useGuildPermissions } from '@/lib/permissions';
import { rollCallStatusColor } from '@/lib/status-colors';
import { useUserStore } from '@/lib/store';
import { RollCallStatus, type RollCall, type RollCallGoldPot } from '@/types/roll-call';
import { ActionSuccess } from './ActionSuccess';
import { AsyncContent, DetailSkeleton } from './AsyncContent';
import { ConfirmDialog } from './ConfirmDialog';
import { RollCallEditModal } from './RollCallEditModal';
import { RollCallGoldLoot } from './RollCallGoldLoot';
import { RollCallLootDistribution } from './RollCallLootDistribution';
import { RollCallLootEditModal } from './RollCallLootEditModal';
import { UserAvatar } from './UserAvatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function RollCallDetailContent({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const t = useTranslations('rollCallDetailPage');
  const formatGold = useFormatGold();
  const userName = useUserName();
  const format = useIntlFormatter();

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const statusLabels = {
    [RollCallStatus.OPEN]: t('statusOpen'),
    [RollCallStatus.CANCELLED]: t('statusCancelled'),
    [RollCallStatus.FINISHED]: t('statusFinished'),
    [RollCallStatus.COMPLETED]: t('statusCompleted'),
  };

  const formatCountdown = useCountdownFormatter();
  const guildId = useCurrentGuildId();

  const [entry, setEntry] = useState<RollCall | null>(null);
  const [isMissing, setIsMissing] = useState(false);
  const loadState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    loadState.reset();
    setReloadKey(key => key + 1);
  };
  const refetchEntry = () => {
    if (!id) return;
    apiClient
      .getRollCall(guildId, id)
      .then(data => {
        setEntry(data);
        setIsMissing(false);
        loadState.ready();
      })
      .catch(err => {
        if (isNotFoundError(err)) {
          setEntry(null);
          setIsMissing(true);
          return;
        }
        loadState.failed();
        notify.loadFailed(reload, 'rollCall-detail');
      });
  };
  useEffect(() => {
    refetchEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, id, reloadKey]);

  const [notes, setNotes] = useState('');
  const [isRejectedAsExpired, setIsRejectedAsExpired] = useState(false);
  const { remainingMs, isExpired: hasExpireTimePassed } = useCountdown(entry?.expireTime);
  const isExpired = hasExpireTimePassed || isRejectedAsExpired;
  const timeRemaining = isExpired ? t('expired') : t('remaining', { time: formatCountdown(remainingMs) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<'closed' | 'failed' | null>(null);
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null);
  const checkInModal = useOverlayState();
  const currentUserId = useUserStore(state => state.user?.id);
  const { can } = useGuildPermissions();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isCompleteConfirmOpen, setIsCompleteConfirmOpen] = useState(false);
  const editModal = useOverlayState();
  const lootEditModal = useOverlayState();
  const [lootInVault, setLootInVault] = useState<number | null>(null);
  const [lootVersion, setLootVersion] = useState(0);
  const completeBlockedId = useId();

  if (isMissing) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Icon icon="solar:ghost-linear" width={48} className="text-disabled" />
        <p className="text-subtle">{t('notFound')}</p>
        <Button variant="secondary" onPress={() => onClose ? onClose() : router.back()}>
          {t('goBack')}
        </Button>
      </div>
    );
  }

  if (!entry) {
    return (
      <AsyncContent state={loadState.state} onRetry={reload} skeleton={<DetailSkeleton />}>
        {null}
      </AsyncContent>
    );
  }

  const isOpen_ = entry.status === RollCallStatus.OPEN && !isExpired;
  const displayStatus = entry.status === RollCallStatus.OPEN && isExpired ? RollCallStatus.FINISHED : entry.status;
  const statusLabel = statusLabels[displayStatus];
  const statusColor = rollCallStatusColor[displayStatus];
  const hasCheckedIn = !!currentUserId && entry.attendanceList.some(member => member.userId === currentUserId);

  const canCancel = isOpen_ && can('cancelRollCall');
  const canEdit = isOpen_ && can('editRollCall');
  const canEditLoot =
    entry.status !== RollCallStatus.CANCELLED && entry.status !== RollCallStatus.COMPLETED && can('editRollCallLoot');
  const canComplete = displayStatus === RollCallStatus.FINISHED && can('completeRollCall');
  const remainingLoot = entry.lootList.length === 0 ? 0 : lootInVault;
  const remainingGold = entry.goldLoot?.remaining ?? 0;
  const isCompleteBlocked = remainingLoot !== 0 || remainingGold > 0;
  const completeBlockers = [
    ...(remainingLoot ? [t('completeBlocked', { count: remainingLoot })] : []),
    ...(remainingGold > 0 ? [t('completeBlockedGold', { amount: formatGold(remainingGold) })] : []),
  ];

  const announceChange = () => {
    emitLiveEvent({ kind: 'resource', guildId, resource: 'rollCall', resourceId: id });
  };

  const handleCancelConfirm = async () => {
    try {
      await apiClient.cancelRollCall(guildId, id);
    } finally {
      refetchEntry();
      announceChange();
    }
  };

  const handleCompleteConfirm = async () => {
    try {
      await apiClient.completeRollCall(guildId, id);
    } finally {
      refetchEntry();
      announceChange();
    }
  };

  const handleLootSaved = (updated: RollCall) => {
    setEntry(current => (current ? { ...updated, attendanceList: current.attendanceList } : updated));
    setLootInVault(null);
    setLootVersion(version => version + 1);
    refetchEntry();
    announceChange();
  };

  const handleEditSaved = (updated: RollCall) => {
    setEntry(current => (current ? { ...updated, attendanceList: current.attendanceList } : updated));
    refetchEntry();
    announceChange();
  };

  const handleGoldPotChange = (goldLoot: RollCallGoldPot) => {
    setEntry(current => (current ? { ...current, goldLoot } : current));
  };

  const handleEditRejected = () => {
    refetchEntry();
    announceChange();
  };

  const openCheckInModal = () => {
    setSubmitError(null);
    setCheckedInAt(null);
    checkInModal.open();
  };

  const handleCheckInConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const attendee = await apiClient.checkIn(guildId, id, notes.trim());
      setNotes('');
      setCheckedInAt(attendee.checkedInAt || new Date().toISOString());
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        checkInModal.close();
        notify.info(t('alreadyCheckedIn'));
      } else if (status === 400) {
        setIsRejectedAsExpired(true);
        setSubmitError('closed');
      } else {
        setSubmitError('failed');
      }
    } finally {
      setIsSubmitting(false);
      refetchEntry();
    }
  };

  const sectionClass = onClose ? '' : 'p-5 rounded-xl border border-divider bg-surface';
  const sectionGap = onClose ? 'gap-6' : 'gap-4';
  const sectionStack = onClose ? 'space-y-6' : 'space-y-4';

  return (
    <div className="space-y-5">
      {/* Back button - only show if not in modal mode */}
      {!onClose && (
        <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={() => router.push('/dashboard/roll-calls')}>
          <Icon icon="solar:arrow-left-linear" width={16} />
          {t('backToRollCalls')}
        </Button>
      )}

      {entry.imageUrl && (
        <div className="overflow-hidden rounded-xl border border-divider bg-surface-secondary">
          <img alt={entry.title} src={entry.imageUrl} className="max-h-[480px] w-full object-cover" />
        </div>
      )}

            {/* Header */}
      <div className={`flex flex-col sm:flex-row items-start gap-4 type-body ${onClose ? 'pr-8' : sectionClass}`}>
        <div className="p-4 rounded-xl bg-default shrink-0">
          <Icon icon="heroicons:clipboard-document-check" width={36} className="text-subtle" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip size="sm" color={statusColor} variant="secondary">
              {statusLabel}
            </Chip>
            {entry.expireTime && isOpen_ && (
              <Chip size="sm" variant="secondary">
                <Icon icon="solar:clock-circle-linear" width={12} />
                {timeRemaining}
              </Chip>
            )}
          </div>
          <h1 className="type-title text-foreground">{entry.title}</h1>
          <p className="text-subtle mt-1">{formatDateTime(entry.date)}</p>
          {entry.description && (
            <p className="type-body text-foreground mt-3 whitespace-pre-line break-words">{entry.description}</p>
          )}
        </div>
        {hasCheckedIn ? (
          <Button
            isDisabled
            variant="secondary"
            className="shrink-0 max-sm:h-11 bg-success-soft text-success-soft-foreground disabled:opacity-100 disabled:cursor-default"
          >
            <Icon icon="solar:check-circle-linear" width={16} />
            {t('checkedIn')}
          </Button>
        ) : isOpen_ ? (
          <Button variant="primary" className="shrink-0 max-sm:h-11" onPress={openCheckInModal}>
            {t('checkIn')}
          </Button>
        ) : null}
        {canEdit && (
          <Button variant="secondary" className="shrink-0 max-sm:h-11" onPress={editModal.open}>
            <Icon icon="solar:pen-linear" width={16} />
            {t('editRollCall')}
          </Button>
        )}
        {canComplete && (
          <Button
            variant="primary"
            className="shrink-0 max-sm:h-11"
            isDisabled={isCompleteBlocked}
            aria-describedby={completeBlockers.length > 0 ? completeBlockedId : undefined}
            onPress={() => setIsCompleteConfirmOpen(true)}
          >
            <Icon icon="solar:check-read-linear" width={16} />
            {t('completeRollCall')}
          </Button>
        )}
        {canCancel && (
          <Button variant="danger-soft" className="shrink-0 max-sm:h-11" onPress={() => setIsCancelConfirmOpen(true)}>
            <Icon icon="solar:forbidden-circle-linear" width={16} />
            {t('cancelRollCall')}
          </Button>
        )}
        {(!hasCheckedIn || checkedInAt) && (
          <Modal state={checkInModal}>
          <Modal.Backdrop isDismissable={!isSubmitting} isKeyboardDismissDisabled={isSubmitting}>
            <Modal.Container size="sm">
              <Modal.Dialog>
                <Modal.CloseTrigger isDisabled={isSubmitting} />
                {checkedInAt ? (
                  <ActionSuccess
                    title={t('checkInSuccess')}
                    detail={t('checkInSuccessDetail', { time: formatDateTime(checkedInAt) })}
                  />
                ) : (
                  <>
                    <Modal.Header className="flex-row items-center gap-2 pr-8">
                      <Icon
                        icon="heroicons:clipboard-document-check"
                        width={18}
                        className="text-subtle shrink-0"
                      />
                      <Modal.Heading>{t('checkInTitle', { title: entry.title })}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="flex flex-col gap-3">
                      <p className="type-body text-subtle">{formatDateTime(entry.date)}</p>
                      <TextField>
                        <Label>{t('notesOptional')}</Label>
                        <TextArea
                          placeholder={t('notesPlaceholder')}
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                          variant="secondary"
                          rows={2}
                          maxLength={500}
                        />
                      </TextField>
                      {submitError && (
                        <p role="alert" className="type-caption text-danger">
                          {submitError === 'failed'
                            ? t('checkInFailed')
                            : entry.status === RollCallStatus.CANCELLED
                              ? t('checkInCancelled')
                              : t('checkInExpired')}
                        </p>
                      )}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button slot="close" variant="secondary" isDisabled={isSubmitting}>
                        {t('cancel')}
                      </Button>
                      <Button variant="primary" isPending={isSubmitting} isDisabled={!isOpen_} onPress={handleCheckInConfirm}>
                        {({ isPending }) => (
                          <>
                            {isPending && <Spinner color="current" size="sm" />}
                            {t('confirmCheckIn')}
                          </>
                        )}
                      </Button>
                    </Modal.Footer>
                  </>
                )}
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
          </Modal>
        )}
      </div>

      {canEdit && (
        <RollCallEditModal
          entry={entry}
          state={editModal}
          onSaved={handleEditSaved}
          onClosed={handleEditRejected}
        />
      )}

      {canEditLoot && (
        <RollCallLootEditModal
          entry={entry}
          state={lootEditModal}
          onSaved={handleLootSaved}
          onConflict={refetchEntry}
        />
      )}

      <ConfirmDialog
        heading={t('completeConfirmTitle')}
        body={t('completeConfirmBody')}
        confirmLabel={t('completeConfirm')}
        failedMessage={t('completeFailed')}
        status="warning"
        isOpen={isCompleteConfirmOpen}
        onOpenChange={setIsCompleteConfirmOpen}
        onConfirm={handleCompleteConfirm}
        success={{ title: t('completeSuccess'), detail: t('completeSuccessDetail') }}
      />

      <ConfirmDialog
        heading={t('cancelConfirmTitle')}
        body={t('cancelConfirmBody')}
        confirmLabel={t('cancelConfirm')}
        failedMessage={t('cancelFailed')}
        isOpen={isCancelConfirmOpen}
        onOpenChange={setIsCancelConfirmOpen}
        onConfirm={handleCancelConfirm}
        success={{ title: t('cancelSuccess'), detail: t('cancelSuccessDetail') }}
      />

      <div className={`grid grid-cols-1 lg:grid-cols-5 ${sectionGap}`}>
        {/* Left — loot + attendance */}
        <div className={`lg:col-span-3 ${sectionStack}`}>
          {/* Loot List */}
          <div className={`space-y-4 ${sectionClass}`}>
            <div className="flex items-center justify-between type-body">
              <div className="flex items-center gap-2">
                <h2 className="type-subheading text-foreground">
                  {t('loot')}
                </h2>
                <Chip size="sm" variant="secondary">
                  {t('items', { count: entry.lootList.length })}
                </Chip>
              </div>
              {canEditLoot && (
                <Button size="sm" variant="secondary" className="max-sm:h-11" onPress={lootEditModal.open}>
                  <Icon icon="solar:pen-linear" width={16} />
                  {t('editLoot')}
                </Button>
              )}
            </div>

            {canComplete && completeBlockers.length > 0 && (
              <div id={completeBlockedId} className="type-caption text-warning flex items-start gap-1.5">
                <Icon icon="solar:info-circle-linear" width={14} className="mt-0.5 shrink-0" />
                <span>{completeBlockers.join(' ')}</span>
              </div>
            )}

            {entry.lootList.length === 0 && !entry.goldLoot ? (
              <p className="type-body text-subtle text-center py-4">{t('noLootItems')}</p>
            ) : (
              <div className="space-y-2">
                {entry.goldLoot && (
                  <RollCallGoldLoot
                    rollCallId={entry.id}
                    pot={entry.goldLoot}
                    attendees={entry.attendanceList}
                    onPotChange={handleGoldPotChange}
                  />
                )}
                {entry.lootList.length > 0 && (
                  <RollCallLootDistribution
                    key={lootVersion}
                    rollCallId={entry.id}
                    lootList={entry.lootList}
                    attendees={entry.attendanceList}
                    onVaultCountChange={setLootInVault}
                  />
                )}
              </div>
            )}
          </div>

          {/* Attendance List */}
          <div className={`space-y-4 ${sectionClass}`}>
            <div className="flex items-center justify-between type-body">
              <h2 className="type-subheading text-foreground">
                {t('attendance')}
              </h2>
              <Chip size="sm" variant="secondary">
                {t('members', { count: entry.attendanceList.length })}
              </Chip>
            </div>

            {entry.attendanceList.length === 0 ? (
              <p className="type-body text-subtle text-center py-4">{t('noAttendeesYet')}</p>
            ) : (
              <div className="space-y-2">
                {entry.attendanceList.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-divider bg-surface-secondary"
                  >
                    <span className="type-caption text-hint w-5 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <UserAvatar name={userName(member.username)} src={member.avatar} className="shrink-0" />
                    <div className="flex-1 min-w-0 sm:flex sm:items-center sm:gap-3">
                      <div className="min-w-0 sm:flex-1">
                        <p className="type-body font-medium text-foreground truncate">{userName(member.username)}</p>
                        {member.notes && (
                          <p className="type-caption text-hint truncate">{member.notes}</p>
                        )}
                      </div>
                      <span className="block type-caption text-hint sm:shrink-0">
                        {formatDateTime(member.checkedInAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — details */}
        <div className={`lg:col-span-2 ${sectionStack}`}>
          {/* Timing */}
          <div className={`space-y-3 ${sectionClass}`}>
            <h2 className="type-subheading text-foreground">
              {t('timing')}
            </h2>
            <div className="space-y-2 type-body">
              <div className="flex justify-between gap-2">
                <span className="text-subtle shrink-0">{t('eventDate')}</span>
                <span className="text-foreground text-right">{formatDateTime(entry.date)}</span>
              </div>
              {entry.expireTime && (
                <>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <span className="text-subtle shrink-0">{t('expires')}</span>
                    <span className="text-foreground text-right">{formatDateTime(entry.expireTime)}</span>
                  </div>
                  {entry.completedAt && (
                    <>
                      <Separator />
                      <div className="flex justify-between gap-2">
                        <span className="text-subtle shrink-0">{t('completedAt')}</span>
                        <span className="text-foreground text-right">{formatDateTime(entry.completedAt)}</span>
                      </div>
                    </>
                  )}
                  {isOpen_ && (
                    <div className="flex items-center gap-1.5 text-warning type-caption">
                      <Icon icon="solar:clock-circle-linear" width={12} />
                      <span>{timeRemaining}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className={`space-y-3 ${sectionClass}`}>
            <h2 className="type-subheading text-foreground">
              {t('summary')}
            </h2>
            <div className="space-y-2 type-body">
              <div className="flex items-center justify-between">
                <span className="text-subtle">{t('status')}</span>
                <Chip size="sm" color={statusColor} variant="secondary">
                  {statusLabel}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">{t('lootItems')}</span>
                <span className="text-foreground">{entry.lootList.length}</span>
              </div>
              {entry.goldLoot && (
                <div className="flex justify-between gap-2">
                  <span className="text-subtle shrink-0">{t('goldLoot')}</span>
                  <span className="text-foreground tabular-nums text-right">
                    {t('goldDistributedOfTotal', {
                      distributed: formatGold(entry.goldLoot.distributed),
                      total: formatGold(entry.goldLoot.total),
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-subtle">{t('awarded')}</span>
                <span className="text-foreground">
                  {remainingLoot === null
                    ? entry.lootList.filter(l => l.winner).length
                    : entry.lootList.length - remainingLoot}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">{t('attendees')}</span>
                <span className="text-foreground">{entry.attendanceList.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
