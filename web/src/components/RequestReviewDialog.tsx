'use client';

import { Alert, Button, Label, Modal, TextArea, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import type { ReviewableRequest } from '@/lib/admin-inbox';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { ReviewDecision } from '@/types/guild-bank';

export interface ReviewTarget {
  decision: ReviewDecision;
  requests: ReviewableRequest[];
}

const APPROVE_HINTS = {
  fund: 'approveFundHint',
  item: 'approveItemHint',
  withdrawal: 'approveWithdrawalHint',
} as const;

const reviewErrorKey = (err: unknown, kind: ReviewableRequest['kind']) => {
  switch (apiErrorCode(err)) {
    case GrpcCode.PermissionDenied:
      return 'errorForbidden';
    case GrpcCode.FailedPrecondition:
      return kind === 'withdrawal' ? 'errorWithdrawalConflict' : 'errorConflict';
    case GrpcCode.NotFound:
      return 'errorNotFound';
    default:
      return 'errorGeneric';
  }
};

const submitReview = (guildId: string, entry: ReviewableRequest, decision: ReviewDecision, note?: string) => {
  switch (entry.kind) {
    case 'fund':
      return apiClient.reviewFundRequest(guildId, entry.request.id, decision, note);
    case 'item':
      return apiClient.reviewItemRequest(guildId, entry.request.id, decision, note);
    case 'withdrawal':
      return apiClient.reviewWithdrawalRequest(guildId, entry.request.id, decision, note);
  }
};

const requestReason = (entry: ReviewableRequest) =>
  entry.kind === 'withdrawal' ? entry.request.note : entry.request.reason;

interface RequestReviewDialogProps {
  guildId: string;
  target: ReviewTarget | null;
  onClose: () => void;
  onReviewed: (reviewedKeys: string[]) => void;
}

export function RequestReviewDialog({ guildId, target, onClose, onReviewed }: RequestReviewDialogProps) {
  const t = useTranslations('adminInbox');
  const userName = useUserName();
  const formatGold = useFormatGold();
  const notify = useToast();
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [shownTarget, setShownTarget] = React.useState(target);

  if (target && target !== shownTarget) {
    setShownTarget(target);
    setNote('');
    setError(null);
  }

  const decision = shownTarget?.decision ?? 'approved';
  const requests = shownTarget?.requests ?? [];
  const single = requests.length === 1 ? requests[0] : null;
  const isApprove = decision === 'approved';

  const submit = async () => {
    if (requests.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    const trimmed = note.trim() || undefined;
    const reviewed: string[] = [];
    let lastError: unknown = null;
    for (const entry of requests) {
      try {
        await submitReview(guildId, entry, decision, trimmed);
        reviewed.push(`${entry.kind}:${entry.request.id}`);
      } catch (err) {
        lastError = err;
      }
    }
    setIsSubmitting(false);
    onReviewed(reviewed);
    if (single && lastError) {
      setError(t(reviewErrorKey(lastError, single.kind)));
      return;
    }
    onClose();
    const failed = requests.length - reviewed.length;
    if (single) notify.success(t('reviewSuccess', { decision }));
    else if (failed === 0) notify.success(t('batchSuccess', { count: reviewed.length, decision }));
    else notify.error(t('batchPartial', { succeeded: reviewed.length, failed, decision }));
  };

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={target !== null}
        isDismissable={!isSubmitting}
        onOpenChange={open => {
          if (!open) onClose();
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>
                {single ? t('reviewTitle', { decision }) : t('batchTitle', { count: requests.length, decision })}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              {single && (
                <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary p-3">
                  <p className="type-body font-medium text-foreground">
                    {single.kind === 'item'
                      ? single.request.itemName || t('unknownItem')
                      : formatGold(single.request.amount)}
                  </p>
                  <p className="type-caption text-hint">
                    {t('requestedBy', { name: userName(single.request.requesterName) })}
                  </p>
                  {requestReason(single) && (
                    <p className="type-body text-subtle break-words">{requestReason(single)}</p>
                  )}
                </div>
              )}
              <p className="type-body text-soft">
                {single
                  ? isApprove
                    ? t(APPROVE_HINTS[single.kind])
                    : t(single.kind === 'withdrawal' ? 'rejectWithdrawalHint' : 'rejectHint')
                  : t('batchHint', { decision })}
              </p>
              <TextField>
                <Label>{t('noteLabel')}</Label>
                <TextArea
                  variant="secondary"
                  rows={2}
                  placeholder={single ? t('notePlaceholder') : t('batchNotePlaceholder')}
                  value={note}
                  onChange={event => setNote(event.target.value)}
                />
              </TextField>
              {error && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Content>
                </Alert>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" isDisabled={isSubmitting}>
                {t('cancel')}
              </Button>
              <Button variant={isApprove ? 'primary' : 'danger'} isPending={isSubmitting} onPress={submit}>
                {single
                  ? t(isApprove ? 'approve' : 'reject')
                  : t(isApprove ? 'approveSelected' : 'rejectSelected', { count: requests.length })}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
