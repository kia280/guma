'use client';

import { Button, Chip, Separator, Modal, Spinner, TextArea, TextField, Label, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useLoadState } from '@/hooks/useLoadState';
import { useCountdown } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import { emitLiveEvent } from '@/lib/live-events';
import { useGuildPermissions } from '@/lib/permissions';
import { checkinStatusColor } from '@/lib/status-colors';
import { useUserStore } from '@/lib/store';
import { CheckinStatus, type CheckinEntry } from '@/types/checkin';
import { ActionSuccess } from './ActionSuccess';
import { AsyncContent, DetailSkeleton } from './AsyncContent';
import { CheckinEditModal } from './CheckinEditModal';
import { CheckinLootDistribution } from './CheckinLootDistribution';
import { ConfirmDialog } from './ConfirmDialog';
import { UserAvatar } from './UserAvatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinDetailContent({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const t = useTranslations('checkinDetailPage');
  const userName = useUserName();
  const format = useIntlFormatter();

  const formatDateTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return format.dateTime(date, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const statusLabels = {
    [CheckinStatus.OPEN]: t('statusOpen'),
    [CheckinStatus.CANCELLED]: t('statusCancelled'),
    [CheckinStatus.FINISHED]: t('statusFinished'),
  };

  const formatCountdown = useCountdownFormatter();
  const guildId = useCurrentGuildId();

  const [entry, setEntry] = useState<CheckinEntry | null>(null);
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
      .getCheckin(guildId, id)
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
        notify.loadFailed(reload, 'checkin-detail');
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
  const checkinModal = useOverlayState();
  const currentUserId = useUserStore(state => state.user?.id);
  const { can } = useGuildPermissions();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const editModal = useOverlayState();

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

  const isOpen_ = entry.status === CheckinStatus.OPEN && !isExpired;
  const displayStatus = entry.status === CheckinStatus.OPEN && isExpired ? CheckinStatus.FINISHED : entry.status;
  const statusLabel = statusLabels[displayStatus];
  const statusColor = checkinStatusColor[displayStatus];
  const hasCheckedIn = !!currentUserId && entry.attendanceList.some(member => member.userId === currentUserId);

  const canCancel = isOpen_ && can('cancelCheckin');
  const canEdit = isOpen_ && can('editCheckin');

  const announceChange = () => {
    emitLiveEvent({ kind: 'resource', guildId, resource: 'checkin', resourceId: id });
  };

  const handleCancelConfirm = async () => {
    try {
      await apiClient.cancelCheckin(guildId, id);
    } finally {
      refetchEntry();
      announceChange();
    }
  };

  const handleEditSaved = (updated: CheckinEntry) => {
    setEntry(current => (current ? { ...updated, attendanceList: current.attendanceList } : updated));
    refetchEntry();
    announceChange();
  };

  const handleEditRejected = () => {
    refetchEntry();
    announceChange();
  };

  const openCheckinModal = () => {
    setSubmitError(null);
    setCheckedInAt(null);
    checkinModal.open();
  };

  const handleCheckinConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const attendee = await apiClient.submitAttendance(guildId, id, notes.trim());
      setNotes('');
      setCheckedInAt(attendee.checkedInAt || new Date().toISOString());
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        checkinModal.close();
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
        <Button variant="secondary" size="sm" className="max-sm:h-11" onPress={() => router.push('/dashboard/attendance')}>
          <Icon icon="solar:arrow-left-linear" width={16} />
          {t('backToCheckins')}
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
          <Chip size="sm" color="success" variant="secondary" className="shrink-0">
            <Icon icon="solar:check-circle-linear" width={14} />
            {t('checkedIn')}
          </Chip>
        ) : isOpen_ ? (
          <Button variant="primary" className="shrink-0 max-sm:h-11" onPress={openCheckinModal}>
            {t('checkIn')}
          </Button>
        ) : null}
        {canEdit && (
          <Button variant="secondary" className="shrink-0 max-sm:h-11" onPress={editModal.open}>
            <Icon icon="solar:pen-linear" width={16} />
            {t('editCheckin')}
          </Button>
        )}
        {canCancel && (
          <Button variant="danger-soft" className="shrink-0 max-sm:h-11" onPress={() => setIsCancelConfirmOpen(true)}>
            <Icon icon="solar:forbidden-circle-linear" width={16} />
            {t('cancelCheckin')}
          </Button>
        )}
        {(!hasCheckedIn || checkedInAt) && (
          <Modal state={checkinModal}>
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
                            : entry.status === CheckinStatus.CANCELLED
                              ? t('checkInCancelled')
                              : t('checkInExpired')}
                        </p>
                      )}
                    </Modal.Body>
                    <Modal.Footer>
                      <Button slot="close" variant="secondary" isDisabled={isSubmitting}>
                        {t('cancel')}
                      </Button>
                      <Button variant="primary" isPending={isSubmitting} isDisabled={!isOpen_} onPress={handleCheckinConfirm}>
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
        <CheckinEditModal
          entry={entry}
          state={editModal}
          onSaved={handleEditSaved}
          onClosed={handleEditRejected}
        />
      )}

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
              <h2 className="type-subheading text-foreground">
                {t('loot')}
              </h2>
              <Chip size="sm" variant="secondary">
                {t('items', { count: entry.lootList.length })}
              </Chip>
            </div>

            {entry.lootList.length === 0 ? (
              <p className="type-body text-subtle text-center py-4">{t('noLootItems')}</p>
            ) : (
              <CheckinLootDistribution
                checkinId={entry.id}
                lootList={entry.lootList}
                attendees={entry.attendanceList}
              />
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
              <p className="type-body text-subtle text-center py-4">{t('noCheckinsYet')}</p>
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
              <div className="flex justify-between">
                <span className="text-subtle">{t('awarded')}</span>
                <span className="text-foreground">
                  {entry.lootList.filter(l => l.winner).length}
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
