'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Chip,
  Avatar,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { mockCheckins, CheckinStatus, CheckinEntry } from '../data';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const t = useTranslations('checkinDetailPage');

  const statusConfig = {
    [CheckinStatus.OPEN]: { label: t('statusOpen'), color: 'success' as const },
    [CheckinStatus.CLOSED]: { label: t('statusClosed'), color: 'default' as const },
    [CheckinStatus.FINISHED]: { label: t('statusFinished'), color: 'primary' as const },
  };

  const formatTimeRemaining = (expireTime: string) => {
    const diff = new Date(expireTime).getTime() - Date.now();
    if (diff <= 0) return t('expired');
    const hours = Math.floor(diff / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m ${t('remaining')}`;
    return `${minutes}m ${t('remaining')}`;
  };

  const [entry, setEntry] = useState<CheckinEntry | null>(
    () => mockCheckins.find(c => c.id === id) ?? null
  );
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
        <Icon icon="solar:ghost-linear" width={48} className="text-default-300" />
        <p className="text-default-500">{t('notFound')}</p>
        <Button variant="flat" onPress={() => router.back()}>
          {t('goBack')}
        </Button>
      </div>
    );
  }

  const { label: statusLabel, color: statusColor } = statusConfig[entry.status];
  const isOpen_ = entry.status === CheckinStatus.OPEN;

  const handleCheckinConfirm = () => {
    setEntry(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        status: CheckinStatus.FINISHED,
        attendanceList: [
          ...prev.attendanceList,
          {
            id: `a-${Date.now()}`,
            username: 'You',
            checkedInAt: new Date().toISOString(),
            notes: notes.trim() || undefined,
          },
        ],
      };
    });
    setNotes('');
    onOpenChange();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Button
        variant="flat"
        size="sm"
        startContent={<Icon icon="solar:arrow-left-linear" width={16} />}
        onPress={() => router.push('/dashboard/checkin')}
      >
        {t('backToCheckins')}
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-4 p-5 rounded-xl border border-divider bg-content1">
        <div className="p-4 rounded-xl bg-default-100 shrink-0">
          <Icon icon="heroicons:clipboard-document-check" width={36} className="text-default-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Chip size="sm" color={statusColor} variant="flat">
              {statusLabel}
            </Chip>
            {entry.expireTime && isOpen_ && (
              <Chip
                size="sm"
                color="warning"
                variant="flat"
                startContent={<Icon icon="solar:clock-circle-linear" width={12} />}
              >
                {timeRemaining}
              </Chip>
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">{entry.description}</h1>
          <p className="text-sm text-default-500 mt-1">{entry.date}</p>
        </div>
        {isOpen_ && (
          <Button color="primary" onPress={onOpen} className="shrink-0">
            {t('checkIn')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left — attendance + loot */}
        <div className="lg:col-span-3 space-y-4">
          {/* Attendance List */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
                {t('attendance')}
              </h2>
              <Chip size="sm" variant="flat">
                {entry.attendanceList.length} {t('members')}
              </Chip>
            </div>

            {entry.attendanceList.length === 0 ? (
              <p className="text-sm text-default-400 text-center py-4">{t('noCheckinsYet')}</p>
            ) : (
              <div className="space-y-2">
                {entry.attendanceList.map((member, idx) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-divider bg-content2"
                  >
                    <span className="text-xs text-default-400 w-5 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <Avatar name={member.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{member.username}</p>
                      {member.notes && (
                        <p className="text-xs text-default-400 truncate">{member.notes}</p>
                      )}
                    </div>
                    <span className="text-xs text-default-400 shrink-0">
                      {formatDateTime(member.checkedInAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Loot List */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
                {t('loot')}
              </h2>
              <Chip size="sm" variant="flat">
                {entry.lootList.length} {t('items')}
              </Chip>
            </div>

            {entry.lootList.length === 0 ? (
              <p className="text-sm text-default-400 text-center py-4">{t('noLootItems')}</p>
            ) : (
              <div className="space-y-2">
                {entry.lootList.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-divider bg-content2"
                  >
                    <div className="p-1.5 rounded-lg bg-default-100 shrink-0">
                      <Icon icon="solar:box-linear" width={16} className="text-default-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      {item.winner && (
                        <p className="text-xs text-default-400">
                          {t('wonBy')} {item.winner}
                        </p>
                      )}
                    </div>
                    {item.quantity && (
                      <Chip size="sm" variant="flat">
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
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-3">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('timing')}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-default-400 shrink-0">{t('eventDate')}</span>
                <span className="text-foreground text-right">{entry.date}</span>
              </div>
              {entry.expireTime && (
                <>
                  <Divider />
                  <div className="flex justify-between gap-2">
                    <span className="text-default-400 shrink-0">{t('expires')}</span>
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
                    <div className="flex items-center gap-1.5 text-warning text-xs">
                      <Icon icon="solar:clock-circle-linear" width={12} />
                      <span>{timeRemaining}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="p-5 rounded-xl border border-divider bg-content1 space-y-3">
            <h2 className="text-sm font-semibold text-default-600 uppercase tracking-wide">
              {t('summary')}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-default-400">{t('status')}</span>
                <Chip size="sm" color={statusColor} variant="flat">
                  {statusLabel}
                </Chip>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('attendees')}</span>
                <span className="text-foreground">{entry.attendanceList.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('lootItems')}</span>
                <span className="text-foreground">{entry.lootList.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-400">{t('awarded')}</span>
                <span className="text-foreground">
                  {entry.lootList.filter(l => l.winner).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Check In Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="top-center" size="sm">
        <ModalContent>
          {onClose => (
            <>
              <ModalHeader>
                <div className="flex items-center gap-2">
                  <Icon
                    icon="heroicons:clipboard-document-check"
                    width={18}
                    className="text-default-500"
                  />
                  {t('checkIn')} — {entry.description}
                </div>
              </ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">{entry.date}</p>
                <Textarea
                  label={t('notesOptional')}
                  placeholder={t('notesPlaceholder')}
                  value={notes}
                  onValueChange={setNotes}
                  variant="bordered"
                  minRows={2}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  {t('cancel')}
                </Button>
                <Button color="primary" onPress={handleCheckinConfirm}>
                  {t('confirmCheckIn')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
