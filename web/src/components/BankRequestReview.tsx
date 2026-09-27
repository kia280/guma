'use client';

import {
  Alert,
  Button,
  Card,
  Chip,
  Label,
  Modal,
  Spinner,
  Tabs,
  TextArea,
  TextField,
  cn,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemThumbnail, getRarityColor } from '@/components/ItemThumbnail';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { requestStatusColor } from '@/lib/status-colors';
import type { FundRequest, ItemRequest, RequestStatus, ReviewDecision } from '@/types/guild-bank';

type View = 'pending' | 'reviewed';

type ReviewTarget =
  | { kind: 'fund'; request: FundRequest; decision: ReviewDecision }
  | { kind: 'item'; request: ItemRequest; decision: ReviewDecision };

const reviewErrorKey = (err: unknown) => {
  switch (apiErrorCode(err)) {
    case GrpcCode.PermissionDenied:
      return 'errorForbidden';
    case GrpcCode.FailedPrecondition:
      return 'errorConflict';
    case GrpcCode.NotFound:
      return 'errorNotFound';
    default:
      return 'errorGeneric';
  }
};

interface RequestRowProps {
  requester: string;
  createdAt: string;
  reason: string;
  status: RequestStatus;
  reviewNote?: string;
  leading: React.ReactNode;
  summary: React.ReactNode;
  onReview: (decision: ReviewDecision) => void;
  isHighlighted?: boolean;
}

function RequestRow({ requester, createdAt, reason, status, reviewNote, leading, summary, onReview, isHighlighted = false }: RequestRowProps) {
  const t = useTranslations('bankRequestReview');
  const format = useIntlFormatter();
  const rowRef = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    if (isHighlighted) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [isHighlighted]);

  return (
    <li
      ref={rowRef}
      className={cn(
        'flex flex-col gap-3 rounded-lg bg-surface-secondary px-3 py-3 sm:flex-row sm:items-center',
        isHighlighted && 'ring-2 ring-accent',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2">
            <p className="type-body font-medium text-foreground truncate">{requester}</p>
            <p className="type-caption text-hint">
              {format.dateTime(new Date(createdAt), { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          {summary}
          {reason && <p className="type-body text-subtle break-words">{reason}</p>}
          {reviewNote && (
            <p className="type-caption text-hint break-words">
              {t('reviewNoteLabel')}: {reviewNote}
            </p>
          )}
        </div>
      </div>
      {status === 'pending' ? (
        <div className="flex shrink-0 gap-2 self-end sm:self-center">
          <Button size="sm" variant="secondary" onPress={() => onReview('rejected')}>
            {t('reject')}
          </Button>
          <Button size="sm" variant="primary" onPress={() => onReview('approved')}>
            {t('approve')}
          </Button>
        </div>
      ) : (
        <Chip size="sm" variant="secondary" color={requestStatusColor[status]} className="self-end sm:self-center">
          {t(`statuses.${status}`)}
        </Chip>
      )}
    </li>
  );
}

interface RequestSectionProps {
  title: string;
  icon: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}

function RequestSection({ title, icon, count, emptyText, children }: RequestSectionProps) {
  return (
    <Card className="border border-divider shadow-none bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-default">
          <Icon className="text-subtle" icon={icon} width={20} />
        </div>
        <p className="type-subheading text-foreground">{title}</p>
        <Chip size="sm" variant="secondary">
          {count}
        </Chip>
      </Card.Header>
      <Card.Content className="pt-0">
        {count === 0 ? (
          <p className="type-body text-disabled py-6 text-center">{emptyText}</p>
        ) : (
          <ul className="flex flex-col gap-2">{children}</ul>
        )}
      </Card.Content>
    </Card>
  );
}

export function BankRequestReview({ guildId, focusRequestId }: { guildId: string; focusRequestId?: string | null }) {
  const t = useTranslations('bankRequestReview');
  const formatGold = useFormatGold();
  const reviewModal = useOverlayState();

  const [view, setView] = React.useState<View>('pending');
  const [fundRequests, setFundRequests] = React.useState<FundRequest[]>([]);
  const [itemRequests, setItemRequests] = React.useState<ItemRequest[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const [target, setTarget] = React.useState<ReviewTarget | null>(null);
  const [note, setNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);

  const latestLoad = React.useRef(0);
  const foregroundPending = React.useRef(false);
  const [focusResolvedFor, setFocusResolvedFor] = React.useState<string | null>(null);

  const load = React.useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    const loadId = ++latestLoad.current;
    const foreground = !background || foregroundPending.current;
    foregroundPending.current = foreground;
    if (!background) {
      setIsLoading(true);
      setLoadFailed(false);
    }
    const status = view === 'pending' ? 'pending' : undefined;
    try {
      const [funds, items] = await Promise.all([
        apiClient.listFundRequests(guildId, status),
        apiClient.listItemRequests(guildId, status),
      ]);
      if (loadId !== latestLoad.current) return;
      const visible = <T extends { status: RequestStatus }>(list: T[]) =>
        view === 'pending' ? list : list.filter(r => r.status !== 'pending');
      setFundRequests(visible(funds));
      setItemRequests(visible(items));
      setLoadFailed(false);
    } catch {
      if (loadId === latestLoad.current && foreground) setLoadFailed(true);
    } finally {
      if (loadId === latestLoad.current) {
        foregroundPending.current = false;
        setIsLoading(false);
      }
    }
  }, [guildId, view]);

  const refresh = React.useCallback(() => load({ background: true }), [load]);

  React.useEffect(() => {
    load();
  }, [load]);

  useLiveResource(['bank'], refresh, { guildId });

  const focusFound =
    !!focusRequestId && (fundRequests.some(r => r.id === focusRequestId) || itemRequests.some(r => r.id === focusRequestId));
  if (focusRequestId && focusResolvedFor !== focusRequestId && !isLoading && !loadFailed) {
    setFocusResolvedFor(focusRequestId);
    if (!focusFound && view === 'pending') setView('reviewed');
  }

  const openReview = (next: ReviewTarget) => {
    setTarget(next);
    setNote('');
    setReviewError(null);
    reviewModal.open();
  };

  const submitReview = async () => {
    if (!target) return;
    setIsSubmitting(true);
    setReviewError(null);
    try {
      const trimmed = note.trim() || undefined;
      if (target.kind === 'fund') {
        await apiClient.reviewFundRequest(guildId, target.request.id, target.decision, trimmed);
      } else {
        await apiClient.reviewItemRequest(guildId, target.request.id, target.decision, trimmed);
      }
      reviewModal.close();
      refresh();
    } catch (err) {
      setReviewError(t(reviewErrorKey(err)));
      if (apiErrorCode(err) !== GrpcCode.PermissionDenied) refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isApprove = target?.decision === 'approved';

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        variant="secondary"
        selectedKey={view}
        onSelectionChange={key => setView(key as View)}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('viewLabel')}>
            <Tabs.Tab id="pending">
              {t('pending')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="reviewed">
              {t('reviewed')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner aria-label={t('loading')} />
        </div>
      ) : loadFailed ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('loadFailed')}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => load()}>
            {t('retry')}
          </Button>
        </Alert>
      ) : (
        <>
          <RequestSection
            title={t('fundRequests')}
            icon="solar:wallet-money-linear"
            count={fundRequests.length}
            emptyText={view === 'pending' ? t('emptyPending') : t('emptyReviewed')}
          >
            {fundRequests.map(r => (
              <RequestRow
                key={r.id}
                requester={r.requesterName}
                createdAt={r.createdAt}
                reason={r.reason}
                status={r.status}
                reviewNote={r.reviewNote}
                leading={
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                    <Icon className="text-warning" icon="solar:dollar-minimalistic-linear" width={20} />
                  </div>
                }
                summary={
                  <p className="type-body font-medium text-foreground tabular-nums">
                    {formatGold(r.amount)}
                  </p>
                }
                onReview={decision => openReview({ kind: 'fund', request: r, decision })}
                isHighlighted={r.id === focusRequestId}
              />
            ))}
          </RequestSection>

          <RequestSection
            title={t('itemRequests')}
            icon="solar:box-linear"
            count={itemRequests.length}
            emptyText={view === 'pending' ? t('emptyPending') : t('emptyReviewed')}
          >
            {itemRequests.map(r => (
              <RequestRow
                key={r.id}
                requester={r.requesterName}
                createdAt={r.createdAt}
                reason={r.reason}
                status={r.status}
                reviewNote={r.reviewNote}
                leading={<ItemThumbnail category={r.itemCategory} rarity={r.itemRarity} />}
                summary={
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="type-body font-medium text-foreground truncate">
                      {r.itemName || t('unknownItem')}
                    </p>
                    <Chip size="sm" variant="secondary" color={getRarityColor(r.itemRarity)} className="capitalize">
                      {r.itemRarity}
                    </Chip>
                  </div>
                }
                onReview={decision => openReview({ kind: 'item', request: r, decision })}
                isHighlighted={r.id === focusRequestId}
              />
            ))}
          </RequestSection>
        </>
      )}

      <Modal state={reviewModal}>
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{isApprove ? t('approveTitle') : t('rejectTitle')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                {target && (
                  <div className="flex flex-col gap-1 rounded-lg bg-surface-secondary p-3">
                    <p className="type-body font-medium text-foreground">
                      {target.kind === 'fund'
                        ? formatGold(target.request.amount)
                        : target.request.itemName || t('unknownItem')}
                    </p>
                    <p className="type-caption text-hint">
                      {t('requestedBy', { name: target.request.requesterName })}
                    </p>
                    {target.request.reason && (
                      <p className="type-body text-subtle break-words">{target.request.reason}</p>
                    )}
                  </div>
                )}
                {target && (
                  <p className="type-caption text-subtle">
                    {isApprove
                      ? target.kind === 'fund'
                        ? t('approveFundHint')
                        : t('approveItemHint')
                      : t('rejectHint')}
                  </p>
                )}
                <TextField>
                  <Label>{t('noteLabel')}</Label>
                  <TextArea
                    placeholder={t('notePlaceholder')}
                    value={note}
                    variant="secondary"
                    rows={2}
                    onChange={e => setNote(e.target.value)}
                  />
                </TextField>
                {reviewError && (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{reviewError}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary" isDisabled={isSubmitting}>
                  {t('cancel')}
                </Button>
                <Button
                  variant={isApprove ? 'primary' : 'danger'}
                  isPending={isSubmitting}
                  onPress={submitReview}
                >
                  {isApprove ? t('approve') : t('reject')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
