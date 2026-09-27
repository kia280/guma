'use client';

import {
  Card,
  Button,
  Chip,
  Table,
  Modal,
  useOverlayState,
  Input,
  Autocomplete,
  Label,
  ListBox,
  SearchField,
  EmptyState,
  Description,
  FieldError,
  TextField,
  Pagination,
  Spinner,
  useFilter,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ActionSuccess } from '@/components/ActionSuccess';
import { AsyncContent, AsyncValue, CardGridSkeleton, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import BackpackItemCard from '@/components/BackpackItemCard';
import { BalanceTrendChart } from '@/components/BalanceTrendChart';
import { CreateAuctionModal, type AuctionDraftItem } from '@/components/CreateAuctionModal';
import { CreateLotteryModal } from '@/components/CreateLotteryModal';
import { useBalanceTrend } from '@/hooks/useBalanceTrend';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useLoadState } from '@/hooks/useLoadState';
import { useToast } from '@/hooks/useToast';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { type FormatGold, useFormatGold } from '@/lib/guma/useFormatGold';
import { subscribeLiveEvents, type LiveResource } from '@/lib/live-events';
import { useGuildPermissions } from '@/lib/permissions';
import { transactionStatusColor } from '@/lib/status-colors';
import { BackpackItem } from '@/types/backpack';
import type { MockUser } from '@/types/user';
import type { Transaction, Wallet as WalletType } from '@/types/wallet';

const LIVE_BACKPACK_RESOURCES: readonly LiveResource[] = ['bank', 'auction'];
const LIVE_REFETCH_DEBOUNCE_MS = 250;

const TRANSACTION_KIND_LABELS: Record<string, string> = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  TRANSFER_IN: 'transferIn',
  TRANSFER_OUT: 'transferOut',
  REWARD: 'reward',
  PENALTY: 'penalty',
  AUCTION_WIN: 'auctionWin',
  LOTTERY_TICKET: 'lotteryTicket',
  LOTTERY_WIN: 'lotteryWin',
  BANK_CONTRIBUTION: 'bankContribution',
  FUND_REQUEST_APPROVED: 'fundRequestApproved',
};

const USER_NOTE_KINDS = new Set([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'BANK_CONTRIBUTION',
  'FUND_REQUEST_APPROVED',
]);

const DEFAULT_TRANSFER_NOTE = 'Transfer';

type WalletAction = 'deposit' | 'transfer' | 'withdraw' | 'withdrawItem';

const transactionLabelKey = (transaction: Transaction): string | undefined => {
  if (transaction.kind === 'AUCTION_BID') {
    return transaction.amount > 0 ? 'auctionRefund' : 'auctionBid';
  }
  return transaction.kind ? TRANSACTION_KIND_LABELS[transaction.kind] : undefined;
};

const transactionNote = (transaction: Transaction): string | undefined => {
  const note = transaction.description?.trim();
  if (!note || !transaction.kind || !USER_NOTE_KINDS.has(transaction.kind)) return undefined;
  return note === DEFAULT_TRANSFER_NOTE ? undefined : note;
};

const transactionAmountSign = (amount: number): string => {
  if (amount > 0) return '+';
  if (amount < 0) return '\u2212';
  return '';
};

const formatTransactionAmount = (amount: number, formatGold: FormatGold): string =>
  `${transactionAmountSign(amount)}${formatGold(Math.abs(amount))}`;

const transactionAmountClass = (amount: number): string => {
  if (amount > 0) return 'text-success';
  if (amount < 0) return 'text-danger';
  return 'text-foreground';
};

const getTransactionIcon = (transaction: Transaction) => {
  switch (transaction.kind) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return 'solar:arrow-down-linear';
    case 'WITHDRAWAL':
      return 'solar:arrow-up-linear';
    case 'TRANSFER_OUT':
      return 'solar:arrow-right-linear';
    case 'AUCTION_BID':
    case 'AUCTION_WIN':
      return 'solar:sledgehammer-linear';
    case 'LOTTERY_TICKET':
    case 'LOTTERY_WIN':
      return 'solar:ticket-linear';
    case 'BANK_CONTRIBUTION':
    case 'FUND_REQUEST_APPROVED':
      return 'solar:safe-2-linear';
  }
  switch (transaction.type) {
    case 'transfer':
      return 'solar:arrow-right-linear';
    case 'withdraw':
      return 'solar:arrow-up-linear';
    case 'deposit':
      return 'solar:arrow-down-linear';
    default:
      return 'solar:wallet-linear';
  }
};

type PageNumber = number | 'ellipsis';

const getPageNumbers = (page: number, totalPages: number): PageNumber[] => {
  if (totalPages <= 1) return [];
  const pages: PageNumber[] = [1];
  if (page > 3) pages.push('ellipsis');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (page < totalPages - 2) pages.push('ellipsis');
  pages.push(totalPages);
  return pages;
};

export default function WalletPage() {
  const t = useTranslations('walletPage');
  const labels = useTranslations('createAuctionModal');
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const balanceTrend = useBalanceTrend(guildId);
  const depositModalState = useOverlayState();
  const transferModalState = useOverlayState();
  const withdrawModalState = useOverlayState();
  const itemWithdrawModalState = useOverlayState();
  const auctionModalState = useOverlayState();
  const lotteryModalState = useOverlayState();
  const [auctionItem, setAuctionItem] = React.useState<AuctionDraftItem | null>(null);
  const [lotteryPrize, setLotteryPrize] = React.useState<string | null>(null);

  const [transferAmount, setTransferAmount] = React.useState('');
  const [transferRecipient, setTransferRecipient] = React.useState('');
  const [showTransferErrors, setShowTransferErrors] = React.useState(false);
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [depositAmount, setDepositAmount] = React.useState('');
  const { contains } = useFilter({ sensitivity: 'base' });
  const [selectedItem, setSelectedItem] = React.useState<BackpackItem | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [paginatedGuildId, setPaginatedGuildId] = React.useState(guildId);
  const rowsPerPage = 5;

  const [wallet, setWallet] = React.useState<WalletType | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [backpackItems, setBackpackItems] = React.useState<BackpackItem[]>([]);
  const [mockUsers, setMockUsers] = React.useState<MockUser[]>([]);
  const [pendingAction, setPendingAction] = React.useState<WalletAction | null>(null);
  const [completedAction, setCompletedAction] = React.useState<{ action: WalletAction; detail: string } | null>(null);
  const walletState = useLoadState();
  const transactionsState = useLoadState();
  const backpackState = useLoadState();
  const notify = useToast();
  const [reloadKey, setReloadKey] = React.useState(0);

  const reload = React.useCallback(() => {
    walletState.reset();
    transactionsState.reset();
    backpackState.reset();
    setReloadKey(key => key + 1);
  }, [walletState.reset, transactionsState.reset, backpackState.reset]);

  const refetchTrend = balanceTrend.refetch;
  const refetchBalance = React.useCallback(() => {
    apiClient
      .getWallet(guildId)
      .then(data => {
        setWallet(data);
        walletState.ready();
      })
      .catch(() => {
        walletState.failed();
        notify.loadFailed(reload, 'wallet');
      });
    apiClient
      .listTransactions(guildId)
      .then(data => {
        setTransactions(data);
        transactionsState.ready();
      })
      .catch(() => {
        transactionsState.failed();
        notify.loadFailed(reload, 'wallet');
      });
    refetchTrend();
  }, [guildId, refetchTrend, notify, reload, walletState.ready, walletState.failed, transactionsState.ready, transactionsState.failed]);

  const refetchBackpack = React.useCallback(() => {
    apiClient
      .listBackpack(guildId)
      .then(data => {
        setBackpackItems(data);
        backpackState.ready();
      })
      .catch(() => {
        backpackState.failed();
        notify.loadFailed(reload, 'wallet');
      });
  }, [guildId, notify, reload, backpackState.ready, backpackState.failed]);

  const refetchWallet = React.useCallback(() => {
    refetchBalance();
    refetchBackpack();
  }, [refetchBalance, refetchBackpack]);

  React.useEffect(() => {
    refetchWallet();
    apiClient
      .listMembers(guildId)
      .then(setMockUsers)
      .catch(() => notify.loadFailed(reload, 'wallet'));
  }, [guildId, refetchWallet, reloadKey, notify, reload]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wasOpen = false;
    const scheduleRefetch = () => {
      clearTimeout(timer);
      timer = setTimeout(refetchBalance, LIVE_REFETCH_DEBOUNCE_MS);
    };
    const unsubscribe = subscribeLiveEvents(event => {
      if (event.kind === 'open') {
        if (wasOpen) scheduleRefetch();
        wasOpen = true;
        return;
      }
      if (event.kind !== 'wallet' || event.guildId !== guildId) return;
      setWallet(current => (current ? { ...current, balance: event.balance } : current));
      scheduleRefetch();
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [guildId, refetchBalance]);

  useLiveResource(LIVE_BACKPACK_RESOURCES, refetchBackpack, { guildId });

  const balance = wallet?.balance ?? 0;
  const totalPages = Math.max(1, Math.ceil(transactions.length / rowsPerPage));
  if (paginatedGuildId !== guildId) {
    setPaginatedGuildId(guildId);
    setCurrentPage(1);
  } else if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const transferAmountValue = parseGold(transferAmount);
  const withdrawAmountValue = parseGold(withdrawAmount);
  const transferExceedsBalance = transferAmountValue > balance;
  const withdrawExceedsBalance = withdrawAmountValue > balance;
  const transferAmountError = !(transferAmountValue > 0)
    ? t('amountMustBePositive')
    : transferExceedsBalance
      ? t('insufficientBalance')
      : null;
  const transferRecipientError = transferRecipient ? null : t('recipientRequired');
  const showTransferAmountError = Boolean(transferAmountError) && (showTransferErrors || transferAmount !== '');
  const showTransferRecipientError = Boolean(transferRecipientError) && showTransferErrors;
  const canWithdraw = withdrawAmountValue > 0 && !withdrawExceedsBalance;
  const isActionPending = pendingAction !== null;

  const runAction = async (
    action: WalletAction,
    request: () => Promise<unknown>,
    detail: string,
    onSuccess?: () => void,
  ) => {
    setPendingAction(action);
    try {
      await request();
      refetchWallet();
      onSuccess?.();
      setCompletedAction({ action, detail });
    } catch {
      notify.error(t(`${action}Failed`));
    } finally {
      setPendingAction(null);
    }
  };

  const openActionModal = (modalState: { open: () => void }) => {
    setCompletedAction(null);
    modalState.open();
  };

  const openTransfer = () => {
    setShowTransferErrors(false);
    openActionModal(transferModalState);
  };

  const handleTransfer = (trigger: Element) => {
    if (transferAmountError || transferRecipientError) {
      setShowTransferErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const amount = transferAmountValue;
    const recipient = mockUsers.find(user => user.id === transferRecipient)?.username ?? transferRecipient;
    return runAction(
      'transfer',
      () => apiClient.transfer(guildId, { recipientId: transferRecipient, amount }),
      t('transferSuccessDetail', { amount: formatGold(amount), recipient }),
      () => {
        setTransferAmount('');
        setTransferRecipient('');
      },
    );
  };

  const handleWithdraw = () => {
    if (!canWithdraw) return;
    return runAction(
      'withdraw',
      () => apiClient.withdraw(guildId, withdrawAmountValue),
      t('withdrawSuccessDetail', { amount: formatGold(withdrawAmountValue) }),
      () => setWithdrawAmount(''),
    );
  };

  const handleDeposit = () => {
    const amount = parseGold(depositAmount);
    if (!(amount > 0)) return;
    return runAction(
      'deposit',
      () => apiClient.deposit(guildId, amount),
      t('depositSuccessDetail', { amount: formatGold(amount) }),
      () => setDepositAmount(''),
    );
  };

  const handleItemWithdraw = () => {
    if (!selectedItem) return;
    const itemId = selectedItem.id;
    return runAction(
      'withdrawItem',
      () => apiClient.withdrawBackpackItem(guildId, itemId),
      t('withdrawItemSuccessDetail', { name: selectedItem.item.name }),
    );
  };

  const openItemWithdraw = (item: BackpackItem) => {
    setSelectedItem(item);
    openActionModal(itemWithdrawModalState);
  };


  const transactionTitle = (transaction: Transaction) => {
    const key = transactionLabelKey(transaction);
    return key ? t(`transactionKinds.${key}`) : transaction.description;
  };

  return (
    <div className="space-y-5">
      {/* Balance + Backpack Section */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:wallet-money-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('balanceAndBackpack')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-6">
          {/* Balance Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <AsyncValue state={walletState.state}>
                <p className="type-display text-foreground">{formatGold(balance)}</p>
              </AsyncValue>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button variant="tertiary" className="w-full sm:w-auto" onPress={() => openActionModal(depositModalState)}>
                <Icon icon="solar:arrow-down-linear" width={16} />
                {t('deposit')}
              </Button>
              <Modal state={depositModalState}>
              <Modal.Backdrop isDismissable={!isActionPending} isKeyboardDismissDisabled={isActionPending}>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger isDisabled={isActionPending} />
                    {completedAction?.action === 'deposit' ? (
                      <ActionSuccess title={t('depositSuccess')} detail={completedAction.detail} />
                    ) : (
                      <>
                        <Modal.Header>
                          <Modal.Heading>{t('depositMoney')}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-3">
                          <TextField>
                            <Label>{t('amountLabel')}</Label>
                            <Input
                              autoFocus
                              placeholder="0.00"
                              type="number"
                              min={0}
                              step={GOLD_STEP}
                              inputMode="decimal"
                              value={depositAmount}
                              variant="secondary"
                              onChange={e => setDepositAmount(e.target.value)}
                            />
                          </TextField>
                          <p className="type-caption text-hint px-1">
                            {t('currentBalanceLabel')} {formatGold(balance)}
                          </p>
                        </Modal.Body>
                        <Modal.Footer>
                          <Button slot="close" variant="secondary" isDisabled={isActionPending}>
                            {t('cancel')}
                          </Button>
                          <Button
                            variant="primary"
                            onPress={handleDeposit}
                            isPending={pendingAction === 'deposit'}
                            isDisabled={!(parseGold(depositAmount) > 0)}
                          >
                            {({ isPending }) => (
                              <>
                                {isPending && <Spinner color="current" size="sm" />}
                                {t('deposit')}
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
              <Button variant="primary" className="w-full sm:w-auto" onPress={openTransfer}>
                <Icon icon="solar:arrow-right-linear" width={16} />
                {t('transfer')}
              </Button>
              <Modal state={transferModalState}>
              <Modal.Backdrop isDismissable={!isActionPending} isKeyboardDismissDisabled={isActionPending}>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger isDisabled={isActionPending} />
                    {completedAction?.action === 'transfer' ? (
                      <ActionSuccess title={t('transferSuccess')} detail={completedAction.detail} />
                    ) : (
                      <>
                        <Modal.Header>
                          <Modal.Heading>{t('transferMoney')}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-3">
                          <TextField validationBehavior="aria" isInvalid={showTransferAmountError}>
                            <Label>{t('amountLabel')}</Label>
                            <Input
                              autoFocus
                              placeholder="0.00"
                              type="number"
                              min={0}
                              max={balance}
                              step={GOLD_STEP}
                              inputMode="decimal"
                              value={transferAmount}
                              variant="secondary"
                              onChange={e => setTransferAmount(e.target.value)}
                            />
                            {showTransferAmountError && <FieldError>{transferAmountError}</FieldError>}
                          </TextField>
                          <Autocomplete
                            className="w-full"
                            placeholder={t('searchRecipient')}
                            selectionMode="single"
                            validationBehavior="aria"
                            isInvalid={showTransferRecipientError}
                            value={transferRecipient}
                            onChange={key => setTransferRecipient(key as string)}
                          >
                            <Label>{t('recipient')}</Label>
                            <Autocomplete.Trigger>
                              <Autocomplete.Value />
                              <Autocomplete.Indicator />
                            </Autocomplete.Trigger>
                            <Autocomplete.Popover>
                              <Autocomplete.Filter filter={contains}>
                                <SearchField autoFocus name="search" variant="secondary">
                                  <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder={t('searchRecipient')} />
                                    <SearchField.ClearButton />
                                  </SearchField.Group>
                                </SearchField>
                                <ListBox renderEmptyState={() => <EmptyState>{t('noResults')}</EmptyState>}>
                                  {mockUsers.map(user => (
                                    <ListBox.Item key={user.id} id={user.id} textValue={user.username}>
                                      <div className="flex flex-col">
                                        <Label>{user.username}</Label>
                                        <Description>{user.email}</Description>
                                      </div>
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  ))}
                                </ListBox>
                              </Autocomplete.Filter>
                            </Autocomplete.Popover>
                            {showTransferRecipientError && <FieldError>{transferRecipientError}</FieldError>}
                          </Autocomplete>
                          <p className="type-caption text-hint px-1">
                            {t('available')} {formatGold(balance)}
                          </p>
                        </Modal.Body>
                        <Modal.Footer>
                          <Button slot="close" variant="secondary" isDisabled={isActionPending}>
                            {t('cancel')}
                          </Button>
                          <Button
                            variant="primary"
                            onPress={e => handleTransfer(e.target)}
                            isPending={pendingAction === 'transfer'}
                          >
                            {({ isPending }) => (
                              <>
                                {isPending && <Spinner color="current" size="sm" />}
                                {t('transfer')}
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
              <Button variant="secondary" className="w-full sm:w-auto" onPress={() => openActionModal(withdrawModalState)}>
                <Icon icon="solar:arrow-up-linear" width={16} />
                {t('withdraw')}
              </Button>
              <Modal state={withdrawModalState}>
              <Modal.Backdrop isDismissable={!isActionPending} isKeyboardDismissDisabled={isActionPending}>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger isDisabled={isActionPending} />
                    {completedAction?.action === 'withdraw' ? (
                      <ActionSuccess title={t('withdrawSuccess')} detail={completedAction.detail} />
                    ) : (
                      <>
                        <Modal.Header>
                          <Modal.Heading>{t('withdrawMoney')}</Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-3">
                          <TextField isInvalid={withdrawExceedsBalance}>
                            <Label>{t('amountLabel')}</Label>
                            <Input
                              autoFocus
                              placeholder="0.00"
                              type="number"
                              min={0}
                              max={balance}
                              step={GOLD_STEP}
                              inputMode="decimal"
                              value={withdrawAmount}
                              variant="secondary"
                              onChange={e => setWithdrawAmount(e.target.value)}
                            />
                            <FieldError>{t('insufficientBalance')}</FieldError>
                          </TextField>
                          <p className="type-caption text-hint px-1">
                            {t('available')} {formatGold(balance)}
                          </p>
                          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <Icon
                                className="text-warning shrink-0 mt-0.5"
                                icon="solar:info-circle-bold"
                                width={14}
                              />
                              <p className="type-caption text-warning">{t('withdrawNote')}</p>
                            </div>
                          </div>
                        </Modal.Body>
                        <Modal.Footer>
                          <Button slot="close" variant="secondary" isDisabled={isActionPending}>
                            {t('cancel')}
                          </Button>
                          <Button
                            variant="primary"
                            onPress={handleWithdraw}
                            isPending={pendingAction === 'withdraw'}
                            isDisabled={!canWithdraw}
                          >
                            {({ isPending }) => (
                              <>
                                {isPending && <Spinner color="current" size="sm" />}
                                {t('withdraw')}
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
            </div>
          </div>

          {/* Balance Chart */}
          <div>
            <BalanceTrendChart
              points={balanceTrend.points}
              status={balanceTrend.status}
              onRetry={balanceTrend.retry}
              height={200}
            />
          </div>

        </Card.Content>
      </Card>

      {/* Backpack Items */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:backpack-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between type-body">
              <p className="type-subheading text-foreground">{t('yourItems')}</p>
              <Chip size="sm" variant="tertiary">
                {t('items', { count: backpackItems.length })}
              </Chip>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <AsyncContent
            state={backpackState.state}
            onRetry={reload}
            skeleton={
              <CardGridSkeleton
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                cardClassName="h-24 rounded-xl"
              />
            }
          >
          {backpackItems.length === 0 ? (
            <EmptyContent icon="solar:backpack-linear" title={t('noItems')} description={t('noItemsHint')} />
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {backpackItems.map(item => (
              <BackpackItemCard
                key={item.id}
                item={item}
                onPutToAuction={i => {
                  setAuctionItem({
                    name: i.item.name,
                    description: i.item.description,
                    category: i.item.category,
                    rarity: i.item.rarity,
                    imageUrl: i.item.imageUrl,
                  });
                  auctionModalState.open();
                }}
                onPutToLottery={
                  can('createLottery')
                    ? i => {
                        setLotteryPrize(i.item.name);
                        lotteryModalState.open();
                      }
                    : undefined
                }
                onWithdraw={openItemWithdraw}
              />
            ))}
          </div>
          )}
          </AsyncContent>
          <CreateAuctionModal state={auctionModalState} item={auctionItem} />
          <CreateLotteryModal state={lotteryModalState} prizeItemName={lotteryPrize} />
        </Card.Content>
      </Card>

      {/* Transaction History */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('transactionHistory')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          {(() => {
            const pagedTransactions = transactions.slice(
              (currentPage - 1) * rowsPerPage,
              currentPage * rowsPerPage
            );
            return (
              <AsyncContent state={transactionsState.state} onRetry={reload} skeleton={<ListSkeleton rows={5} />}>
              {transactions.length === 0 ? (
                <EmptyContent
                  icon="solar:history-line-duotone"
                  title={t('noTransactions')}
                  description={t('noTransactionsHint')}
                />
              ) : (
              <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table variant="secondary">
              <Table.ScrollContainer>
                <Table.Content aria-label={t('transactionHistoryTable')} className="min-w-[600px]">
                  <Table.Header>
                    <Table.Column isRowHeader className="w-[45%]">{t('transaction')}</Table.Column>
                    <Table.Column className="w-[20%]">{t('amount')}</Table.Column>
                    <Table.Column className="w-[20%]">{t('date')}</Table.Column>
                    <Table.Column className="w-[15%]">{t('status')}</Table.Column>
                  </Table.Header>
                  <Table.Body>
                    {pagedTransactions.map(transaction => (
                      <Table.Row key={transaction.id}>
                        <Table.Cell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default">
                              <Icon
                                className="text-subtle"
                                icon={getTransactionIcon(transaction)}
                                width={16}
                              />
                            </div>
                            <div className="flex flex-col">
                              <p className="type-body font-medium text-foreground">
                                {transactionTitle(transaction)}
                              </p>
                              {transactionNote(transaction) && (
                                <p className="type-caption text-hint">{transactionNote(transaction)}</p>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span
                            className={`type-body font-medium tabular-nums ${transactionAmountClass(transaction.amount)}`}
                          >
                            {formatTransactionAmount(transaction.amount, formatGold)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <p className="type-body text-subtle">
                            {format.dateTime(new Date(transaction.date), { dateStyle: 'medium' })}
                          </p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip
                            className="capitalize"
                            color={transactionStatusColor[transaction.status]}
                            size="sm"
                            variant="secondary"
                          >
                            {t(transaction.status)}
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
            {pagedTransactions.map(transaction => (
              <div key={transaction.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-default shrink-0">
                      <Icon
                        className="text-subtle"
                        icon={getTransactionIcon(transaction)}
                        width={16}
                      />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <p className="type-body font-medium text-foreground truncate">
                        {transactionTitle(transaction)}
                      </p>
                      {transactionNote(transaction) && (
                        <p className="type-caption text-hint truncate">
                          {transactionNote(transaction)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 type-caption">
                        <p className="text-hint">
                          {format.dateTime(new Date(transaction.date), { dateStyle: 'medium' })}
                        </p>
                        <Chip
                          className="capitalize"
                          color={transactionStatusColor[transaction.status]}
                          size="sm"
                          variant="tertiary"
                        >
                          {t(transaction.status)}
                        </Chip>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span
                      className={`type-body font-medium tabular-nums ${transactionAmountClass(transaction.amount)}`}
                    >
                      {formatTransactionAmount(transaction.amount, formatGold)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination className="justify-center">
                <Pagination.Content>
                  <Pagination.Item>
                    <Pagination.Previous
                      isDisabled={currentPage === 1}
                      onPress={() => setCurrentPage(p => p - 1)}
                    >
                      <Pagination.PreviousIcon />
                    </Pagination.Previous>
                  </Pagination.Item>
                  {pageNumbers.map((p, i) =>
                    p === 'ellipsis' ? (
                      <Pagination.Item key={`ellipsis-${i}`}>
                        <Pagination.Ellipsis />
                      </Pagination.Item>
                    ) : (
                      <Pagination.Item key={p}>
                        <Pagination.Link
                          isActive={p === currentPage}
                          onPress={() => setCurrentPage(p)}
                        >
                          {p}
                        </Pagination.Link>
                      </Pagination.Item>
                    )
                  )}
                  <Pagination.Item>
                    <Pagination.Next
                      isDisabled={currentPage === totalPages}
                      onPress={() => setCurrentPage(p => p + 1)}
                    >
                      <Pagination.NextIcon />
                    </Pagination.Next>
                  </Pagination.Item>
                </Pagination.Content>
              </Pagination>
            </div>
          )}
              </>
              )}
              </AsyncContent>
            );
          })()}
        </Card.Content>
      </Card>

      {/* Withdraw Item Modal */}
      <Modal state={itemWithdrawModalState}>
      <Modal.Backdrop isDismissable={!isActionPending} isKeyboardDismissDisabled={isActionPending}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger isDisabled={isActionPending} />
            {completedAction?.action === 'withdrawItem' ? (
              <ActionSuccess title={t('withdrawItemSuccess')} detail={completedAction.detail} />
            ) : (
              <>
                <Modal.Header>
                  <Modal.Heading>{t('withdrawItem')}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="flex flex-col gap-3">
                  {selectedItem && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                        <div className="p-2 rounded-lg bg-default">
                          <Icon icon="solar:backpack-linear" width={20} className="text-subtle" />
                        </div>
                        <div>
                          <p className="type-body font-medium text-foreground">{selectedItem.item.name}</p>
                          <p className="type-caption text-hint">
                            {labels(`rarities.${selectedItem.item.rarity}`)} · {labels(`categories.${selectedItem.item.category}`)}
                          </p>
                        </div>
                      </div>
                      <p className="type-body text-soft">
                        {t.rich('withdrawItemConfirm', {
                          name: selectedItem.item.name,
                          strong: chunks => <span className="font-medium text-foreground">{chunks}</span>,
                        })}
                      </p>
                      <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Icon
                            className="text-warning shrink-0 mt-0.5"
                            icon="solar:info-circle-bold"
                            width={14}
                          />
                          <p className="type-caption text-warning">{t('withdrawItemNote')}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary" isDisabled={isActionPending}>
                    {t('cancel')}
                  </Button>
                  <Button variant="danger" onPress={handleItemWithdraw} isPending={pendingAction === 'withdrawItem'}>
                    {({ isPending }) => (
                      <>
                        {isPending && <Spinner color="current" size="sm" />}
                        {t('withdrawItem')}
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
    </div>
  );
}
