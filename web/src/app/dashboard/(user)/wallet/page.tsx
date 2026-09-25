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
  TextField,
  Pagination,
  useFilter,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useLocale, useTranslations } from 'next-intl';
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import BackpackItemCard from '@/components/BackpackItemCard';
import { CreateAuctionModal, type AuctionDraftItem } from '@/components/CreateAuctionModal';
import { CreateLotteryModal } from '@/components/CreateLotteryModal';
import { useLiveResource } from '@/hooks/useLiveResource';
import { isLocale } from '@/i18n/locales';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { walletBalanceTrend } from '@/lib/guma/mock/data';
import { localizeMock } from '@/lib/guma/mock/i18n';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { subscribeLiveEvents, type LiveResource } from '@/lib/live-events';
import { useGuildPermissions } from '@/lib/permissions';
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

const formatTransactionAmount = (amount: number): string =>
  `${transactionAmountSign(amount)}$${Math.abs(amount).toFixed(2)}`;

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

export default function WalletPage() {
  const t = useTranslations('walletPage');
  const locale = useLocale();
  const balanceTrend = React.useMemo(
    () => (isLocale(locale) ? localizeMock(walletBalanceTrend, locale) : walletBalanceTrend),
    [locale]
  );
  const guildId = useCurrentGuildId();
  const { can } = useGuildPermissions();
  const itemWithdrawModalState = useOverlayState();
  const auctionModalState = useOverlayState();
  const lotteryModalState = useOverlayState();
  const [auctionItem, setAuctionItem] = React.useState<AuctionDraftItem | null>(null);
  const [lotteryPrize, setLotteryPrize] = React.useState<string | null>(null);

  const [transferAmount, setTransferAmount] = React.useState('');
  const [transferRecipient, setTransferRecipient] = React.useState('');
  const [withdrawAmount, setWithdrawAmount] = React.useState('');
  const [depositAmount, setDepositAmount] = React.useState('');
  const { contains } = useFilter({ sensitivity: 'base' });
  const [selectedItem, setSelectedItem] = React.useState<BackpackItem | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const rowsPerPage = 5;

  const [wallet, setWallet] = React.useState<WalletType | null>(null);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [backpackItems, setBackpackItems] = React.useState<BackpackItem[]>([]);
  const [mockUsers, setMockUsers] = React.useState<MockUser[]>([]);

  const refetchBalance = React.useCallback(() => {
    apiClient.getWallet(guildId).then(setWallet).catch(() => {});
    apiClient.listTransactions(guildId).then(setTransactions).catch(() => {});
  }, [guildId]);

  const refetchBackpack = React.useCallback(() => {
    apiClient.listBackpack(guildId).then(setBackpackItems).catch(() => {});
  }, [guildId]);

  const refetchWallet = React.useCallback(() => {
    refetchBalance();
    refetchBackpack();
  }, [refetchBalance, refetchBackpack]);

  React.useEffect(() => {
    refetchWallet();
    apiClient.listMembers(guildId).then(setMockUsers).catch(() => {});
  }, [guildId, refetchWallet]);

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

  const handleTransfer = async () => {
    const amount = parseGold(transferAmount);
    if (!(amount > 0) || !transferRecipient) return;
    try {
      await apiClient.transfer(guildId, { recipientId: transferRecipient, amount });
      refetchWallet();
    } catch (err) { console.error(err); }
    setTransferAmount('');
    setTransferRecipient('');
  };

  const handleWithdraw = async () => {
    const amount = parseGold(withdrawAmount);
    if (!(amount > 0)) return;
    try {
      await apiClient.withdraw(guildId, amount);
      refetchWallet();
    } catch (err) { console.error(err); }
    setWithdrawAmount('');
  };

  const handleDeposit = async () => {
    const amount = parseGold(depositAmount);
    if (!(amount > 0)) return;
    try {
      await apiClient.deposit(guildId, amount);
      refetchWallet();
    } catch (err) { console.error(err); }
    setDepositAmount('');
  };

  const handleItemWithdraw = async () => {
    if (!selectedItem) return;
    try {
      await apiClient.withdrawBackpackItem(guildId, selectedItem.id);
      refetchWallet();
    } catch (err) { console.error(err); }
    setSelectedItem(null);
    itemWithdrawModalState.close();
  };

  const openItemWithdraw = (item: BackpackItem) => {
    setSelectedItem(item);
    itemWithdrawModalState.open();
  };


  const transactionTitle = (transaction: Transaction) => {
    const key = transactionLabelKey(transaction);
    return key ? t(`transactionKinds.${key}`) : transaction.description;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-5">
      {/* Balance + Backpack Section */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
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
              <p className="type-display text-foreground">${balance.toFixed(2)}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Modal>
              <Button variant="tertiary" className="w-full sm:w-auto">
                <Icon icon="solar:arrow-down-linear" width={16} />
                {t('deposit')}
              </Button>
              <Modal.Backdrop>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header className="text-center items-center">
                      <Modal.Heading>{t('depositMoney')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="p-1 flex flex-col gap-3">
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
                        {t('currentBalanceLabel')} ${balance.toFixed(2)}
                      </p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button slot="close" variant="secondary">
                        {t('cancel')}
                      </Button>
                      <Button
                        variant="tertiary"
                        onPress={handleDeposit}
                        isDisabled={!(parseGold(depositAmount) > 0)}
                      >
                        {t('deposit')}
                      </Button>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
              </Modal>
              <Modal>
              <Button variant="primary" className="w-full sm:w-auto">
                <Icon icon="solar:arrow-right-linear" width={16} />
                {t('transfer')}
              </Button>
              <Modal.Backdrop>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header className="text-center items-center">
                      <Modal.Heading>{t('transferMoney')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="p-1 flex flex-col gap-3">
                      <TextField>
                        <Label>{t('amountLabel')}</Label>
                        <Input
                          autoFocus
                          placeholder="0.00"
                          type="number"
                          min={0}
                          step={GOLD_STEP}
                          inputMode="decimal"
                          value={transferAmount}
                          variant="secondary"
                          onChange={e => setTransferAmount(e.target.value)}
                        />
                      </TextField>
                      <Autocomplete
                        className="w-full"
                        placeholder={t('searchRecipient')}
                        selectionMode="single"
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
                      </Autocomplete>
                      <p className="type-caption text-hint px-1">
                        {t('available')} ${balance.toFixed(2)}
                      </p>
                    </Modal.Body>
                    <Modal.Footer>
                      <Button slot="close" variant="secondary">
                        {t('cancel')}
                      </Button>
                      <Button variant="primary" onPress={handleTransfer}>
                        {t('transfer')}
                      </Button>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
              </Modal>
              <Modal>
              <Button variant="secondary" className="w-full sm:w-auto">
                <Icon icon="solar:arrow-up-linear" width={16} />
                {t('withdraw')}
              </Button>
              <Modal.Backdrop>
                <Modal.Container size="sm">
                  <Modal.Dialog>
                    <Modal.CloseTrigger />
                    <Modal.Header className="text-center items-center">
                      <Modal.Heading>{t('withdrawMoney')}</Modal.Heading>
                    </Modal.Header>
                    <Modal.Body className="p-1 flex flex-col gap-3">
                      <TextField>
                        <Label>{t('amountLabel')}</Label>
                        <Input
                          autoFocus
                          placeholder="0.00"
                          type="number"
                          min={0}
                          step={GOLD_STEP}
                          inputMode="decimal"
                          value={withdrawAmount}
                          variant="secondary"
                          onChange={e => setWithdrawAmount(e.target.value)}
                        />
                      </TextField>
                      <p className="type-caption text-hint px-1">
                        {t('available')} ${balance.toFixed(2)}
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
                      <Button slot="close" variant="secondary">
                        {t('cancel')}
                      </Button>
                      <Button variant="primary" onPress={handleWithdraw}>
                        {t('withdraw')}
                      </Button>
                    </Modal.Footer>
                  </Modal.Dialog>
                </Modal.Container>
              </Modal.Backdrop>
              </Modal>
            </div>
          </div>

          {/* Balance Chart */}
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={balanceTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="walletBalanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--separator)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                />
                <Tooltip
                  formatter={(v: any) => [`$${(v ?? 0).toLocaleString()}`, 'Balance']}
                  contentStyle={{
                    background: 'var(--overlay)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--foreground)',
                  }}
                  labelStyle={{ color: 'var(--muted)' }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  fill="url(#walletBalanceFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--accent)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

        </Card.Content>
      </Card>

      {/* Backpack Items */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:backpack-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="type-subheading text-foreground">{t('yourItems')}</p>
              <Chip size="sm" variant="tertiary">
                {backpackItems.length} {t('items')}
              </Chip>
            </div>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
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
          <CreateAuctionModal state={auctionModalState} item={auctionItem} />
          <CreateLotteryModal state={lotteryModalState} prizeItemName={lotteryPrize} />
        </Card.Content>
      </Card>

      {/* Transaction History */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:history-line-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('transactionHistory')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          {(() => {
            const totalPages = Math.ceil(transactions.length / rowsPerPage);
            const pagedTransactions = transactions.slice(
              (currentPage - 1) * rowsPerPage,
              currentPage * rowsPerPage
            );
            return (
              <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
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
                              {transaction.recipient && (
                                <p className="type-caption text-hint">
                                  {t('to')} {transaction.recipient}
                                </p>
                              )}
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell>
                          <span
                            className={`type-body font-medium ${transactionAmountClass(transaction.amount)}`}
                          >
                            {formatTransactionAmount(transaction.amount)}
                          </span>
                        </Table.Cell>
                        <Table.Cell>
                          <p className="type-body text-subtle">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </Table.Cell>
                        <Table.Cell>
                          <Chip className="capitalize" size="sm" variant="secondary">
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
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="type-caption text-hint">
                          {new Date(transaction.date).toLocaleDateString()}
                        </p>
                        <Chip
                          className="capitalize"
                          color={getStatusColor(transaction.status)}
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
                      className={`type-body font-medium ${transactionAmountClass(transaction.amount)}`}
                    >
                      {formatTransactionAmount(transaction.amount)}
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
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <Pagination.Item key={p}>
                      <Pagination.Link
                        isActive={p === currentPage}
                        onPress={() => setCurrentPage(p)}
                      >
                        {p}
                      </Pagination.Link>
                    </Pagination.Item>
                  ))}
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
            );
          })()}
        </Card.Content>
      </Card>

      {/* Withdraw Item Modal */}
      <Modal state={itemWithdrawModalState}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="text-center items-center">
              <Modal.Heading>{t('withdrawItem')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="p-1 flex flex-col gap-3">
              {selectedItem && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                    <div className="p-2 rounded-lg bg-default">
                      <Icon icon="solar:backpack-linear" width={20} className="text-subtle" />
                    </div>
                    <div>
                      <p className="type-body font-medium text-foreground">{selectedItem.item.name}</p>
                      <p className="type-caption text-hint capitalize">
                        {selectedItem.item.rarity} · {selectedItem.item.category}
                      </p>
                    </div>
                  </div>
                  <p className="type-body text-soft">
                    {t('withdrawItemConfirm')}{' '}
                    <span className="font-medium text-foreground">{selectedItem.item.name}</span>{' '}
                    {t('withdrawItemConfirmSuffix')}
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
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button variant="danger" onPress={handleItemWithdraw}>
                {t('withdrawItem')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
      </Modal>
    </div>
  );
}
