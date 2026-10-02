'use client';

import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { AsyncContent, EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import type { LoadState } from '@/hooks/useLoadState';
import type { Transaction, WithdrawalRequest } from '@/types/wallet';
import { TransactionList } from './TransactionList';
import { TransactionPagination } from './TransactionPagination';

const ROWS_PER_PAGE = 5;

type TransactionHistoryCardProps = {
  guildId: string;
  transactions: Transaction[];
  pendingWithdrawals: WithdrawalRequest[];
  loadState: LoadState;
  onRetry: () => void;
};

export function TransactionHistoryCard({
  guildId,
  transactions,
  pendingWithdrawals,
  loadState,
  onRetry,
}: TransactionHistoryCardProps) {
  const t = useTranslations('walletPage');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [paginatedGuildId, setPaginatedGuildId] = React.useState(guildId);
  const totalPages = Math.max(1, Math.ceil(transactions.length / ROWS_PER_PAGE));
  if (paginatedGuildId !== guildId) {
    setPaginatedGuildId(guildId);
    setCurrentPage(1);
  } else if (currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
  const pendingWithdrawalIds = new Set(pendingWithdrawals.map(request => request.id));
  const pagedTransactions = transactions.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
          <Icon className="text-subtle" icon="solar:history-line-duotone" width={20} />
        </div>
        <div className="flex flex-col">
          <p className="type-subheading text-foreground">{t('transactionHistory')}</p>
        </div>
      </Card.Header>
      <Card.Content className="pt-0">
        <AsyncContent state={loadState} onRetry={onRetry} skeleton={<ListSkeleton rows={5} />}>
          {transactions.length === 0 ? (
            <EmptyContent
              icon="solar:history-line-duotone"
              title={t('noTransactions')}
              description={t('noTransactionsHint')}
            />
          ) : (
            <>
              <TransactionList transactions={pagedTransactions} pendingWithdrawalIds={pendingWithdrawalIds} />
              <TransactionPagination page={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </>
          )}
        </AsyncContent>
      </Card.Content>
    </Card>
  );
}
