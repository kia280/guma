'use client';

import {
  Card,
  Button,
  Chip,
  Table,
  Modal,
  useOverlayState,
  Input,
  TextArea,
  TextField,
  Label,
  Tooltip,
  Alert,
  FieldError,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, AsyncValue, CardGridSkeleton, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import { ItemLockChip } from '@/components/ItemLockChip';
import { ItemThumbnail, getCategoryIcon, getRarityColor } from '@/components/ItemThumbnail';
import { UserAvatar } from '@/components/UserAvatar';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { contributionStatusColor } from '@/lib/status-colors';
import type { GuildBank, GuildContribution, GuildBankItem } from '@/types/guild-bank';



const getContributionIcon = (type: GuildContribution['type']) => {
  switch (type) {
    case 'contribute':
      return 'solar:arrow-down-linear';
    case 'request':
      return 'solar:arrow-up-linear';
    case 'item_donate':
      return 'solar:backpack-linear';
    case 'item_distribute':
      return 'solar:arrow-right-linear';
    case 'checkin_loot':
      return 'solar:clipboard-check-linear';
    case 'auction_proceeds':
      return 'solar:sledgehammer-linear';
  }
};

const isInflowContribution = (type: GuildContribution['type']) =>
  type === 'contribute' || type === 'auction_proceeds';


const isSettledContribution = (status: GuildContribution['status']) =>
  status === 'completed' || status === 'approved';

function ContributionAmount({
  entry,
  align,
}: {
  entry: Pick<GuildContribution, 'type' | 'status'> & { amount: number };
  align: 'start' | 'end';
}) {
  const t = useTranslations('guildBankPage');
  const formatGold = useFormatGold();
  const alignClass = align === 'end' ? 'items-end' : 'items-start';

  if (entry.status === 'pending') {
    return (
      <span className={`flex flex-col ${alignClass}`}>
        <span className="type-body font-medium tabular-nums text-subtle">{formatGold(entry.amount)}</span>
        <span className="type-caption text-hint">{t('amountPending')}</span>
      </span>
    );
  }
  if (!isSettledContribution(entry.status)) {
    return (
      <span className="type-body font-medium tabular-nums text-hint line-through">
        {formatGold(entry.amount)}
      </span>
    );
  }
  return (
    <span
      className={`type-body font-medium tabular-nums ${isInflowContribution(entry.type) ? 'text-success' : 'text-foreground'}`}
    >
      {isInflowContribution(entry.type) ? '+' : '-'}{formatGold(entry.amount)}
    </span>
  );
}

export default function GuildBankPage() {
  const t = useTranslations('guildBankPage');
  const labels = useTranslations('createAuctionModal');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const guildId = useCurrentGuildId();

  const contributeModalState = useOverlayState();
  const requestItemModalState = useOverlayState();
  const requestFundsModalState = useOverlayState();

  const [contributeAmount, setContributeAmount] = React.useState('');
  const [contributeNote, setContributeNote] = React.useState('');
  const [requestAmount, setRequestAmount] = React.useState('');
  const [requestReason, setRequestReason] = React.useState('');
  const [showContributeErrors, setShowContributeErrors] = React.useState(false);
  const [showRequestErrors, setShowRequestErrors] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<GuildBankItem | null>(null);
  const [requestItemReason, setRequestItemReason] = React.useState('');
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [isContributing, setIsContributing] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const [bank, setBank] = React.useState<GuildBank | null>(null);
  const [mockContributions, setMockContributions] = React.useState<GuildContribution[]>([]);
  const [mockGuildItems, setMockGuildItems] = React.useState<GuildBankItem[]>([]);

  const bankState = useLoadState();
  const contributionsState = useLoadState();
  const itemsState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);

  const reload = React.useCallback(() => {
    bankState.reset();
    contributionsState.reset();
    itemsState.reset();
    setReloadKey(key => key + 1);
  }, [bankState.reset, contributionsState.reset, itemsState.reset]);

  const latestRefetch = React.useRef(0);

  const refetchBank = React.useCallback(() => {
    const refetchId = ++latestRefetch.current;
    const ifLatest = <T,>(apply: (value: T) => void) => (value: T) => {
      if (refetchId === latestRefetch.current) apply(value);
    };
    const onLoadFailed = (markFailed: () => void) =>
      ifLatest(() => {
        markFailed();
        notify.loadFailed(reload, 'guild-bank');
      });
    apiClient
      .getGuildBank(guildId)
      .then(ifLatest(data => {
        setBank(data);
        bankState.ready();
      }))
      .catch(onLoadFailed(bankState.failed));
    apiClient
      .listContributions(guildId)
      .then(ifLatest(data => {
        setMockContributions(data);
        contributionsState.ready();
      }))
      .catch(onLoadFailed(contributionsState.failed));
    apiClient
      .listBankItems(guildId)
      .then(ifLatest(data => {
        setMockGuildItems(data);
        itemsState.ready();
      }))
      .catch(onLoadFailed(itemsState.failed));
  }, [
    guildId,
    notify,
    reload,
    bankState.ready,
    bankState.failed,
    contributionsState.ready,
    contributionsState.failed,
    itemsState.ready,
    itemsState.failed,
  ]);

  React.useEffect(() => {
    refetchBank();
  }, [refetchBank, reloadKey]);

  useLiveResource(['bank'], refetchBank, { guildId });

  const guildBalance = bank?.balance ?? 0;

  const contributeAmountValue = parseGold(contributeAmount);
  const contributeAmountError = contributeAmountValue > 0 ? null : t('amountMustBePositive');
  const showContributeAmountError =
    Boolean(contributeAmountError) && (showContributeErrors || contributeAmount !== '');

  const requestAmountValue = parseGold(requestAmount);
  const requestAmountError = !(requestAmountValue > 0)
    ? t('amountMustBePositive')
    : bank && requestAmountValue > bank.balance
      ? t('errorExceedsBalance')
      : null;
  const requestReasonError = requestReason.trim() ? null : t('reasonRequired');
  const showRequestAmountError = Boolean(requestAmountError) && (showRequestErrors || requestAmount !== '');
  const showRequestReasonError = Boolean(requestReasonError) && showRequestErrors;

  const getContributionLabel = (type: GuildContribution['type']) => {
    switch (type) {
      case 'contribute':
        return t('typeContribute');
      case 'request':
        return t('typeRequest');
      case 'item_donate':
        return t('typeItemDonate');
      case 'item_distribute':
        return t('typeItemDistribute');
      case 'checkin_loot':
        return t('typeCheckinLoot');
      case 'auction_proceeds':
        return t('typeAuctionProceeds');
    }
  };

  const openContribute = () => {
    setShowContributeErrors(false);
    contributeModalState.open();
  };

  const handleContribute = async (trigger: Element) => {
    if (contributeAmountError) {
      setShowContributeErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const amount = contributeAmountValue;
    setIsContributing(true);
    try {
      await apiClient.contributeFunds(guildId, { amount, note: contributeNote || undefined });
      refetchBank();
      notify.success(t('contributeSuccess'));
      setContributeAmount('');
      setContributeNote('');
      contributeModalState.close();
    } catch {
      notify.error(t('contributeFailed'));
    } finally {
      setIsContributing(false);
    }
  };

  const requestErrorMessage = (err: unknown) => {
    switch (apiErrorCode(err)) {
      case GrpcCode.FailedPrecondition:
        return t('errorExceedsBalance');
      case GrpcCode.AlreadyExists:
        return t('errorDuplicateItemRequest');
      case GrpcCode.NotFound:
        return t('errorItemUnavailable');
      case GrpcCode.PermissionDenied:
        return t('errorNotMember');
      default:
        return t('errorGeneric');
    }
  };

  const openFundRequest = () => {
    setRequestError(null);
    setShowRequestErrors(false);
    requestFundsModalState.open();
  };

  const handleRequest = async (trigger: Element) => {
    if (requestAmountError || requestReasonError) {
      setShowRequestErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const amount = requestAmountValue;
    setIsRequesting(true);
    setRequestError(null);
    try {
      await apiClient.requestFunds(guildId, { amount, reason: requestReason.trim() });
      refetchBank();
      notify.success(t('requestSuccess'));
      setRequestAmount('');
      setRequestReason('');
      requestFundsModalState.close();
    } catch (err) {
      setRequestError(requestErrorMessage(err));
    } finally {
      setIsRequesting(false);
    }
  };

  const handleRequestItem = async () => {
    if (!selectedItem || !requestItemReason.trim()) return;
    setIsRequesting(true);
    setRequestError(null);
    try {
      await apiClient.requestItem(guildId, selectedItem.id, requestItemReason.trim());
      refetchBank();
      notify.success(t('requestSuccess'));
      setSelectedItem(null);
      setRequestItemReason('');
      requestItemModalState.close();
    } catch (err) {
      setRequestError(requestErrorMessage(err));
    } finally {
      setIsRequesting(false);
    }
  };

  const openItemRequest = (item: GuildBankItem) => {
    setSelectedItem(item);
    setRequestError(null);
    requestItemModalState.open();
  };

  return (
    <div className="space-y-5">
      {/* Guild Treasury */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
            <Icon className="text-warning" icon="solar:safe-2-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('treasury')}</p>
            <p className="type-caption text-hint">{t('treasuryDesc')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-6">
          {/* Balance Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <AsyncValue state={bankState.state}>
                <p className="type-display text-foreground">{formatGold(guildBalance)}</p>
              </AsyncValue>
              <p className="type-caption text-hint mt-0.5">{t('guildGold')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Button
                  variant="primary"
                  className="w-full sm:w-auto"
                  onPress={openContribute}
                >
                  <Icon icon="solar:arrow-down-linear" width={16} />
                  {t('contribute')}
                </Button>
              <Modal state={contributeModalState}>
                <Modal.Backdrop>
                  <Modal.Container size="sm">
                    <Modal.Dialog>
                      <Modal.CloseTrigger />
                      <Modal.Header>
                        <Modal.Heading>{t('contributeTitle')}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="flex flex-col gap-3">
                        <TextField validationBehavior="aria" isInvalid={showContributeAmountError}>
                          <Label>{t('amountLabel')}</Label>
                          <Input
                            autoFocus
                            placeholder="0.00"
                            type="number"
                            min={0}
                            step={GOLD_STEP}
                            inputMode="decimal"
                            value={contributeAmount}
                            variant="secondary"
                            onChange={e => setContributeAmount(e.target.value)}
                          />
                          {showContributeAmountError && <FieldError>{contributeAmountError}</FieldError>}
                        </TextField>
                        <TextField>
                          <Label>{t('noteOptional')}</Label>
                          <TextArea
                            placeholder={t('notePlaceholder')}
                            value={contributeNote}
                            variant="secondary"
                            rows={2}
                            onChange={e => setContributeNote(e.target.value)}
                          />
                        </TextField>
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Icon
                              className="text-warning shrink-0 mt-0.5"
                              icon="solar:info-circle-bold"
                              width={14}
                            />
                            <p className="type-caption text-warning">{t('contributeNote')}</p>
                          </div>
                        </div>
                      </Modal.Body>
                      <Modal.Footer>
                        <Button slot="close" variant="secondary">
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="primary"
                          onPress={e => handleContribute(e.target)}
                          isPending={isContributing}
                        >
                          {t('contribute')}
                        </Button>
                      </Modal.Footer>
                    </Modal.Dialog>
                  </Modal.Container>
                </Modal.Backdrop>
              </Modal>
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onPress={openFundRequest}
              >
                <Icon icon="solar:arrow-up-linear" width={16} />
                {t('requestFunds')}
              </Button>
              <Modal state={requestFundsModalState}>
                <Modal.Backdrop>
                  <Modal.Container size="sm">
                    <Modal.Dialog>
                      <Modal.CloseTrigger />
                      <Modal.Header>
                        <Modal.Heading>{t('requestFundsTitle')}</Modal.Heading>
                      </Modal.Header>
                      <Modal.Body className="flex flex-col gap-3">
                        <TextField validationBehavior="aria" isInvalid={showRequestAmountError}>
                          <Label>{t('amountLabel')}</Label>
                          <Input
                            autoFocus
                            placeholder="0.00"
                            type="number"
                            min={0}
                            step={GOLD_STEP}
                            inputMode="decimal"
                            value={requestAmount}
                            variant="secondary"
                            onChange={e => setRequestAmount(e.target.value)}
                          />
                          {showRequestAmountError && <FieldError>{requestAmountError}</FieldError>}
                        </TextField>
                        <TextField validationBehavior="aria" isInvalid={showRequestReasonError}>
                          <Label>{t('reason')}</Label>
                          <TextArea
                            placeholder={t('reasonPlaceholder')}
                            value={requestReason}
                            variant="secondary"
                            rows={3}
                            onChange={e => setRequestReason(e.target.value)}
                          />
                          {showRequestReasonError && <FieldError>{requestReasonError}</FieldError>}
                        </TextField>
                        <div className="bg-surface-secondary rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Icon
                              className="text-subtle shrink-0 mt-0.5"
                              icon="solar:info-circle-bold"
                              width={14}
                            />
                            <p className="type-caption text-subtle">{t('fundRequestNote')}</p>
                          </div>
                        </div>
                        {requestError && (
                          <Alert status="danger">
                            <Alert.Indicator />
                            <Alert.Content>
                              <Alert.Title>{requestError}</Alert.Title>
                            </Alert.Content>
                          </Alert>
                        )}
                      </Modal.Body>
                      <Modal.Footer>
                        <Button slot="close" variant="secondary">
                          {t('cancel')}
                        </Button>
                        <Button
                          variant="primary"
                          onPress={e => handleRequest(e.target)}
                          isPending={isRequesting}
                        >
                          {t('submitRequest')}
                        </Button>
                      </Modal.Footer>
                    </Modal.Dialog>
                  </Modal.Container>
                </Modal.Backdrop>
              </Modal>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Guild Item Storage */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:box-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="type-subheading text-foreground">{t('storage')}</p>
              <Chip size="sm" variant="tertiary">
                {t('items', { count: mockGuildItems.length })}
              </Chip>
            </div>
            <p className="type-caption text-hint">{t('storageDesc')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <AsyncContent
            state={itemsState.state}
            onRetry={reload}
            skeleton={
              <CardGridSkeleton
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                cardClassName="h-20 rounded-xl"
              />
            }
          >
          {mockGuildItems.length === 0 ? (
            <EmptyContent icon="solar:box-linear" title={t('noItems')} description={t('noItemsHint')} />
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {mockGuildItems.map(item => (
              <Card
                key={item.id}
                className="border border-divider shadow-none bg-surface-secondary hover:border-foreground/20 transition-colors p-2.5 rounded-xl"
              >
                <Card.Content className="flex flex-row items-center gap-3 p-0">
                  <ItemThumbnail category={item.category} rarity={item.rarity} />
                  <div className="flex-1 min-w-0">
                    <p className="type-body font-medium text-foreground truncate">
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="text-hint tabular-nums"> ×{item.quantity}</span>
                      )}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Chip size="sm" color={getRarityColor(item.rarity)} variant="secondary">
                        {labels(`rarities.${item.rarity}`)}
                      </Chip>
                      {item.lock && <ItemLockChip lock={item.lock} />}
                    </div>
                    {item.checkinId && (
                      <Link
                        href={`/dashboard/attendance/${item.checkinId}`}
                        className="mt-1 flex min-w-0 items-center gap-1 rounded type-caption text-hint hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        <Icon icon="solar:clipboard-check-linear" width={14} className="shrink-0" />
                        <span className="truncate">{t('fromCheckin', { title: item.checkinTitle || t('untitledCheckin') })}</span>
                      </Link>
                    )}
                  </div>
                  <Tooltip delay={0}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      className="text-hint shrink-0 max-sm:size-11"
                      aria-label={t('requestItem')}
                      isDisabled={Boolean(item.lock)}
                      onPress={() => openItemRequest(item)}
                    >
                      <Icon icon="solar:hand-shake-linear" width={16} />
                    </Button>
                    <Tooltip.Content>{t('requestItem')}</Tooltip.Content>
                  </Tooltip>
                </Card.Content>
              </Card>
            ))}
          </div>
          )}
          </AsyncContent>
        </Card.Content>
      </Card>

      {/* Contribution History */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('activityHistory')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <AsyncContent state={contributionsState.state} onRetry={reload} skeleton={<ListSkeleton rows={5} />}>
          {mockContributions.length === 0 ? (
            <EmptyContent
              icon="solar:history-line-duotone"
              title={t('noActivity')}
              description={t('noActivityHint')}
            />
          ) : (
          <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label={t('activityTable')} className="min-w-[700px]">
                  <Table.Header>
                    <Table.Column isRowHeader>{t('activity')}</Table.Column>
                    <Table.Column>{t('member')}</Table.Column>
                    <Table.Column>{t('amountItem')}</Table.Column>
                    <Table.Column>{t('date')}</Table.Column>
                    <Table.Column>{t('status')}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {mockContributions.map(entry => (
                      <Table.Row key={entry.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default">
                              <Icon
                                className="text-subtle"
                                icon={getContributionIcon(entry.type)}
                                width={16}
                              />
                            </div>
                            <div className="flex flex-col">
                              <p className="type-body font-medium text-foreground">
                                {getContributionLabel(entry.type)}
                              </p>
                              {entry.note && entry.href ? (
                                <Link
                                  href={entry.href}
                                  className="rounded type-caption text-hint hover:text-accent truncate max-w-[180px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                                >
                                  {entry.note}
                                </Link>
                              ) : entry.note && (
                                <p className="type-caption text-hint truncate max-w-[180px]">
                                  {entry.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <div className="flex items-center gap-2">
                            <UserAvatar name={entry.member} src={entry.memberAvatar} className="size-6" />
                            <p className="type-body text-foreground">{entry.member}</p>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          {entry.amount !== undefined ? (
                            <ContributionAmount entry={{ ...entry, amount: entry.amount }} align="start" />
                          ) : (
                            <span className="type-body text-subtle line-clamp-2 max-w-[220px]">{entry.itemName}</span>
                          )}
                        </Table.Cell>
                        <Table.Cell>
                          <p className="type-body text-subtle">
                            {format.dateTime(new Date(entry.date), { dateStyle: 'medium' })}
                          </p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            color={contributionStatusColor[entry.status]}
                            size="sm"
                            variant="tertiary"
                          >
                            {t(entry.status)}
                          </Chip>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Content>
              </Table.ScrollContainer>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-divider">
            {mockContributions.map(entry => (
              <div key={entry.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default shrink-0">
                      <Icon
                        className="text-subtle"
                        icon={getContributionIcon(entry.type)}
                        width={16}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="type-body font-medium text-foreground truncate">
                          {getContributionLabel(entry.type)}
                        </p>
                      </div>
                      {entry.href && entry.note && (
                        <Link
                          href={entry.href}
                          className="self-start rounded type-caption text-hint hover:text-accent truncate max-w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          {entry.note}
                        </Link>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="type-caption text-hint">{entry.member}</p>
                        <p className="type-caption text-hint">
                          {format.dateTime(new Date(entry.date), { dateStyle: 'medium' })}
                        </p>
                        <Chip size="sm" color={contributionStatusColor[entry.status]} variant="secondary">
                          {t(entry.status)}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {entry.amount !== undefined ? (
                      <ContributionAmount entry={{ ...entry, amount: entry.amount }} align="end" />
                    ) : (
                      <span className="type-caption text-subtle line-clamp-2 max-w-[140px] block">{entry.itemName}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
          )}
          </AsyncContent>
        </Card.Content>
      </Card>

      {/* Request Item Modal */}
      <Modal state={requestItemModalState}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('requestItemTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              {selectedItem && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                    <div className="p-2 rounded-lg bg-default">
                      <Icon
                        icon={getCategoryIcon(selectedItem.category)}
                        width={20}
                        className="text-subtle"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="type-body font-medium text-foreground">{selectedItem.name}</p>
                      <p className="type-caption text-hint">
                        {t('itemSummary', {
                          rarity: labels(`rarities.${selectedItem.rarity}`),
                          category: labels(`categories.${selectedItem.category}`),
                          count: selectedItem.quantity,
                        })}
                      </p>
                    </div>
                  </div>
                  <TextField>
                    <Label>{t('reason')}</Label>
                    <TextArea
                      autoFocus
                      placeholder={t('itemReasonPlaceholder')}
                      value={requestItemReason}
                      variant="secondary"
                      rows={3}
                      onChange={e => setRequestItemReason(e.target.value)}
                    />
                  </TextField>
                  <div className="bg-surface-secondary rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Icon
                        className="text-subtle shrink-0 mt-0.5"
                        icon="solar:info-circle-bold"
                        width={14}
                      />
                      <p className="type-caption text-subtle">{t('itemRequestNote')}</p>
                    </div>
                  </div>
                  {requestError && (
                    <Alert status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{requestError}</Alert.Title>
                      </Alert.Content>
                    </Alert>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={handleRequestItem}
                isPending={isRequesting}
                isDisabled={!requestItemReason.trim()}
              >
                {t('submitRequest')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
