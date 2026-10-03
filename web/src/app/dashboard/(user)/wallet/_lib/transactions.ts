import type { FormatGold } from '@/lib/guma/useFormatGold';
import type { Transaction } from '@/types/wallet';

const TRANSACTION_KIND_LABELS: Record<string, string> = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  TRANSFER_IN: 'transferIn',
  TRANSFER_OUT: 'transferOut',
  REWARD: 'reward',
  PENALTY: 'penalty',
  AUCTION_WIN: 'auctionWin',
  AUCTION_SALE: 'auctionSale',
  RAFFLE_TICKET: 'raffleTicket',
  RAFFLE_WIN: 'raffleWin',
  BANK_CONTRIBUTION: 'bankContribution',
  FUND_REQUEST_APPROVED: 'fundRequestApproved',
  ROLL_CALL_GOLD: 'rollCallGold',
  WITHDRAWAL_REQUEST: 'withdrawalRequest',
  WITHDRAWAL_APPROVED: 'withdrawalApproved',
  WITHDRAWAL_REJECTED: 'withdrawalRejected',
  WITHDRAWAL_CANCELLED: 'withdrawalCancelled',
};

export const WITHDRAWAL_REQUEST_KIND = 'WITHDRAWAL_REQUEST';

const USER_NOTE_KINDS = new Set([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'BANK_CONTRIBUTION',
  'FUND_REQUEST_APPROVED',
  'ROLL_CALL_GOLD',
  'ADMIN_TRANSFER_OUT',
  'ADMIN_TRANSFER_IN',
  'WITHDRAWAL_REQUEST',
  'WITHDRAWAL_APPROVED',
  'WITHDRAWAL_REJECTED',
]);

const DEFAULT_TRANSFER_NOTE = 'Transfer';

export const transactionLabelKey = (transaction: Transaction): string | undefined => {
  if (transaction.kind === 'AUCTION_BID') {
    return transaction.amount > 0 ? 'auctionRefund' : 'auctionBid';
  }
  if (transaction.kind === 'RAFFLE_TICKET' && transaction.amount > 0) {
    return 'raffleRefund';
  }
  if (transaction.kind === 'ADMIN_TRANSFER_OUT') {
    return transaction.referenceType === 'bank' ? 'adminTransferToBank' : 'adminTransferOut';
  }
  if (transaction.kind === 'ADMIN_TRANSFER_IN') {
    return 'adminTransferIn';
  }
  return transaction.kind ? TRANSACTION_KIND_LABELS[transaction.kind] : undefined;
};

export const transactionNote = (transaction: Transaction): string | undefined => {
  const note = transaction.description?.trim();
  if (!note || !transaction.kind || !USER_NOTE_KINDS.has(transaction.kind)) return undefined;
  return note === DEFAULT_TRANSFER_NOTE ? undefined : note;
};

export const transactionHref = (transaction: Transaction): string | undefined => {
  if (!transaction.referenceId) return undefined;
  switch (transaction.referenceType) {
    case 'auction':
      return `/dashboard/auction/${transaction.referenceId}`;
    case 'raffle':
      return `/dashboard/raffle/${transaction.referenceId}`;
    case 'fund_request':
      return `/dashboard/guild-bank?request=${transaction.referenceId}`;
    case 'roll_call':
      return `/dashboard/roll-calls/${transaction.referenceId}`;
    default:
      return undefined;
  }
};

export const TRANSACTION_LINK_CLASS =
  'rounded hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const transactionAmountSign = (amount: number): string => {
  if (amount > 0) return '+';
  if (amount < 0) return '\u2212';
  return '';
};

export const formatTransactionAmount = (amount: number, formatGold: FormatGold): string =>
  `${transactionAmountSign(amount)}${formatGold(Math.abs(amount))}`;

export const transactionAmountClass = (amount: number): string => {
  if (amount > 0) return 'text-success';
  if (amount < 0) return 'text-danger';
  return 'text-foreground';
};

export const getTransactionIcon = (transaction: Transaction) => {
  switch (transaction.kind) {
    case 'DEPOSIT':
    case 'TRANSFER_IN':
      return 'solar:arrow-down-linear';
    case 'WITHDRAWAL':
    case 'WITHDRAWAL_REQUEST':
    case 'WITHDRAWAL_APPROVED':
      return 'solar:arrow-up-linear';
    case 'WITHDRAWAL_REJECTED':
    case 'WITHDRAWAL_CANCELLED':
      return 'solar:undo-left-linear';
    case 'TRANSFER_OUT':
    case 'ADMIN_TRANSFER_OUT':
      return transaction.referenceType === 'bank' ? 'solar:safe-2-linear' : 'solar:arrow-right-linear';
    case 'ADMIN_TRANSFER_IN':
      return 'solar:arrow-down-linear';
    case 'AUCTION_BID':
    case 'AUCTION_WIN':
    case 'AUCTION_SALE':
      return 'solar:sledgehammer-linear';
    case 'RAFFLE_TICKET':
    case 'RAFFLE_WIN':
      return 'solar:ticket-linear';
    case 'BANK_CONTRIBUTION':
    case 'FUND_REQUEST_APPROVED':
      return 'solar:safe-2-linear';
    case 'ROLL_CALL_GOLD':
      return 'solar:clipboard-check-linear';
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

export const getPageNumbers = (page: number, totalPages: number): PageNumber[] => {
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
