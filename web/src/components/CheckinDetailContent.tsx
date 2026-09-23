'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Chip, Avatar, Separator, Modal, TextArea, TextField, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { CheckinStatus, type CheckinEntry } from '@/types/checkin';
import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinDetailContent({ id, onClose }: { id: string; onClose?: () => void }) {
  const router = useRouter();
  const t = useTranslations('checkinDetailPage');

  const statusConfig = {
    [CheckinStatus.OPEN]: { label: t('statusOpen'), color: 'success' as const },
    [CheckinStatus.CLOSED]: { label: t('statusClosed'), color: 'default' as const },
    [CheckinStatus.FINISHED]: { label: t('statusFinished'), color: 'accent' as const },
  };

  const formatTimeRemaining = (expireTime: string) => {
    const diff = new Date(expireTime).getTime() - Date.now();
    if (diff <= 0) return t('expired');
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m ${t('remaining')}`;
    return `${minutes}m ${t('remaining')}`;
  };

  const guildId = useCurrentGuildId();

  const [entry, setEntry] = useState<CheckinEntry | null>(null);
  const refetchEntry = () => {
    if (!id) return;
    apiClient.getCheckin(guildId, id).then(setEntry).catch(() => setEntry(null));
  };
  useEffect(() => {
    refetchEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, id]);

  const [notes, setNotes] = useState('');
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!entry?.expireTime) return;
    const tick = () => setTimeRemaining(formatTimeRemaining(entry.expireTime!));
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [entry]);

  if (!entry) {
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

  const { label: statusLabel, color: statusColor } = statusConfig[entry.status];
  const isOpen_ = entry.status === CheckinStatus.OPEN;

  const handleCheckinConfirm = async () => {
    try {
      await apiClient.submitAttendance(guildId, id);
      refetchEntry();
    } catch (err) {
      console.error(err);
    }
    setNotes('');
  };

  return (
    <div className="space-y-5">
      {/* Back button - only show if not in modal mode */}
      {!onClose && (
        <Button variant="secondary" size="sm" onPress={() => router.push('/dashboard/checkin')}>
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
            <Chip size="sm" variant="secondary">
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
          <p className="type-body text-subtle mt-1">{entry.date}</p>
        </div>
        {isOpen_ && (
          <Modal>
          <Button variant="primary" className="shrink-0">
            {t('checkIn')}
          </Button>
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
                      {t('checkIn')} — {entry.description}
                    </div>
                  </Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  <p className="type-body text-subtle">{entry.date}</p>
                  <TextField>
                    <Label>{t('notesOptional')}</Label>
                    <TextArea
                      placeholder={t('notesPlaceholder')}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      variant="secondary"
                      rows={2}
                    />
                  </TextField>
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary">
                    {t('cancel')}
                  </Button>
                  <Button variant="primary" onPress={handleCheckinConfirm}>
                    {t('confirmCheckIn')}
                  </Button>
                </Modal.Footer>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
          </Modal>
        )}
      </div>

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
                {entry.attendanceList.length} {t('members')}
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
                    <Avatar size="sm">
                      <Avatar.Fallback>{member.username.slice(0, 2).toUpperCase()}</Avatar.Fallback>
                    </Avatar>
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
                {entry.lootList.length} {t('items')}
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
                        <p className="type-caption text-hint">
                          {t('wonBy')} {item.winner}
                        </p>
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
                <span className="text-foreground text-right">{entry.date}</span>
              </div>
              {entry.expireTime && (
                <>
                  <Separator />
                  <div className="flex justify-between gap-2">
                    <span className="text-subtle shrink-0">{t('expires')}</span>
                    <span className="text-foreground text-right">
                      {new Date(entry.expireTime).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
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
