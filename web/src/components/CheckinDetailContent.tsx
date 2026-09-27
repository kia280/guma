'use client';

import { Button, Chip, Separator, Modal, TextArea, TextField, Label, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useLoadState } from '@/hooks/useLoadState';
import { useCountdown } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useCountdownFormatter } from '@/i18n/useCountdownFormatter';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { isNotFoundError } from '@/lib/guma/errors';
import { useGuildPermissions } from '@/lib/permissions';
import { checkinStatusColor } from '@/lib/status-colors';
import { useUserStore } from '@/lib/store';
import { CheckinStatus, type CheckinEntry } from '@/types/checkin';
import { AsyncContent, DetailSkeleton } from './AsyncContent';
import { ConfirmDialog } from './ConfirmDialog';
import { UserAvatar } from './UserAvatar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinDetailContent({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const t = useTranslations('checkinDetailPage');
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
  const [submitError, setSubmitError] = useState('');
  const checkinModal = useOverlayState();
  const currentUserId = useUserStore(state => state.user?.id);
  const { can } = useGuildPermissions();
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);

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

  const handleCancelConfirm = async () => {
    try {
      await apiClient.cancelCheckin(guildId, id);
      notify.success(t('cancelSuccess'));
    } finally {
      refetchEntry();
    }
  };

  const openCheckinModal = () => {
    setSubmitError('');
    checkinModal.open();
  };

  const handleCheckinConfirm = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await apiClient.submitAttendance(guildId, id, notes.trim());
      setNotes('');
      checkinModal.close();
      notify.success(t('checkInSuccess'));
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        checkinModal.close();
        notify.info(t('alreadyCheckedIn'));
      } else if (status === 400) {
        setIsRejectedAsExpired(true);
        setSubmitError(t('checkInExpired'));
      } else {
        setSubmitError(t('checkInFailed'));
      }
    } finally {
      setIsSubmitting(false);
      refetchEntry();
    }
  };

  return (
    <div className="space-y-5">
      {/* Back button - only show if not in modal mode */}
      {!onClose && (
        <Button variant="secondary" size="sm" onPress={() => router.push('/dashboard/attendance')}>
          <Icon icon="solar:arrow-left-linear" width={16} />
          {t('backToCheckins')}
        </Button>
      )}

      {entry.imageUrl && (
        <div className="overflow-hidden rounded-xl border border-divider bg-surface-secondary">
          <img alt={entry.description} src={entry.imageUrl} className="max-h-[480px] w-full object-cover" />
        </div>
      )}

            {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-divider bg-surface">
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
          <h1 className="type-title text-foreground">{entry.description}</h1>
          <p className="type-body text-subtle mt-1">{formatDateTime(entry.date)}</p>
        </div>
        {hasCheckedIn ? (
          <Chip color="success" variant="secondary" className="shrink-0">
            <Icon icon="solar:check-circle-linear" width={14} />
            {t('checkedIn')}
          </Chip>
        ) : isOpen_ ? (
          <Button variant="primary" className="shrink-0" onPress={openCheckinModal}>
            {t('checkIn')}
          </Button>
        ) : null}
        {canCancel && (
          <Button variant="danger-soft" className="shrink-0" onPress={() => setIsCancelConfirmOpen(true)}>
            <Icon icon="solar:forbidden-circle-linear" width={16} />
            {t('cancelCheckin')}
          </Button>
        )}
        {!hasCheckedIn && (
          <Modal state={checkinModal}>
          <Modal.Backdrop>
            <Modal.Container size="sm">
              <Modal.Dialog>
                <Modal.CloseTrigger />
                <Modal.Header className="text-center items-center">
                  <Modal.Heading>
                    <div className="flex items-center gap-2">
                      <Icon
                        icon="heroicons:clipboard-document-check"
                        width={18}
                        className="text-subtle"
                      />
                      {t('checkInTitle', { title: entry.description })}
                    </div>
                  </Modal.Heading>
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
                      {submitError}
                    </p>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary">
                    {t('cancel')}
                  </Button>
                  <Button variant="primary" isPending={isSubmitting} isDisabled={!isOpen_} onPress={handleCheckinConfirm}>
                    {t('confirmCheckIn')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
          </Modal>
        )}
      </div>

      <ConfirmDialog
        heading={t('cancelConfirmTitle')}
        body={t('cancelConfirmBody')}
        confirmLabel={t('cancelConfirm')}
        failedMessage={t('cancelFailed')}
        isOpen={isCancelConfirmOpen}
        onOpenChange={setIsCancelConfirmOpen}
        onConfirm={handleCancelConfirm}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left — attendance + loot */}
        <div className="lg:col-span-3 space-y-4">
          {/* Attendance List */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-4">
            <div className="flex items-center justify-between">
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
                    <UserAvatar name={member.username} src={member.avatar} />
                    <div className="flex-1 min-w-0">
                      <p className="type-body font-medium text-foreground">{member.username}</p>
                      {member.notes && (
                        <p className="type-caption text-hint truncate">{member.notes}</p>
                      )}
                    </div>
                    <span className="type-caption text-hint shrink-0">
                      {formatDateTime(member.checkedInAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loot List */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-4">
            <div className="flex items-center justify-between">
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
              <div className="space-y-2">
                {entry.lootList.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-divider bg-surface-secondary"
                  >
                    <div className="p-1.5 rounded-lg bg-default shrink-0">
                      <Icon icon="solar:box-linear" width={16} className="text-subtle" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="type-body font-medium text-foreground">{item.name}</p>
                      {item.winner && (
                        <p className="type-caption text-hint">{t('wonBy', { name: item.winner })}</p>
                      )}
                    </div>
                    {item.quantity && (
                      <Chip size="sm" variant="secondary">
                        ×{item.quantity}
                      </Chip>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right — details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timing */}
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-3">
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
          <div className="p-5 rounded-xl border border-divider bg-surface space-y-3">
            <h2 className="type-subheading text-foreground">
              {t('summary')}
            </h2>
            <div className="space-y-2 type-body">
              <div className="flex justify-between">
                <span className="text-subtle">{t('status')}</span>
                <Chip size="sm" color={statusColor} variant="secondary">
                  {statusLabel}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-subtle">{t('attendees')}</span>
                <span className="text-foreground">{entry.attendanceList.length}</span>
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
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
