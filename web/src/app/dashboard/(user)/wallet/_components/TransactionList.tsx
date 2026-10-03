'use client';

import { Chip, Table } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { transactionStatusColor } from '@/lib/status-colors';
import type { Transaction } from '@/types/wallet';
import {
  TRANSACTION_LINK_CLASS,
  WITHDRAWAL_REQUEST_KIND,
  formatTransactionAmount,
  getTransactionIcon,
  transactionAmountClass,
  transactionHref,
  transactionLabelKey,
  transactionNote,
} from '../_lib/transactions';

type TransactionListProps = {
  transactions: Transaction[];
  pendingWithdrawalIds: ReadonlySet<string>;
};

export function TransactionList({ transactions, pendingWithdrawalIds }: TransactionListProps) {
  const t = useTranslations('walletPage');
  const userName = useUserName();
  const format = useIntlFormatter();
  const formatGold = useFormatGold();

  const isPendingReview = (transaction: Transaction) =>
    transaction.kind === WITHDRAWAL_REQUEST_KIND &&
    Boolean(transaction.referenceId) &&
    pendingWithdrawalIds.has(transaction.referenceId ?? '');
  const transactionStatus = (transaction: Transaction): Transaction['status'] =>
    isPendingReview(transaction) ? 'pending' : transaction.status;
  const transactionStatusLabel = (transaction: Transaction) =>
    isPendingReview(transaction) ? t('pendingReview') : t(transaction.status);

  const transactionTitle = (transaction: Transaction) => {
    const key = transactionLabelKey(transaction);
    const title = key
      ? t(`transactionKinds.${key}`, {
          admin: userName(transaction.actorName ?? ''),
          member: userName(transaction.counterpartyName ?? ''),
        })
      : transaction.description;
    const href = transactionHref(transaction);
    return href ? (
      <Link href={href} className={TRANSACTION_LINK_CLASS}>
        {title}
      </Link>
    ) : (
      title
    );
  };

  const amount = (transaction: Transaction) => (
    <span className={`type-body font-medium tabular-nums ${transactionAmountClass(transaction.amount)}`}>
      {formatTransactionAmount(transaction.amount, formatGold)}
    </span>
  );

  const typeIcon = (transaction: Transaction, className: string) => (
    <div className={className}>
      <Icon className="text-subtle" icon={getTransactionIcon(transaction)} width={16} />
    </div>
  );

  const date = (transaction: Transaction) => format.dateTime(new Date(transaction.date), { dateStyle: 'medium' });

  return (
    <>
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
                {transactions.map(transaction => (
                  <Table.Row key={transaction.id}>
                    <Table.Cell>
                      <div className="flex items-center gap-3">
                        {typeIcon(transaction, 'flex h-8 w-8 items-center justify-center rounded-lg bg-default')}
                        <div className="flex flex-col">
                          <p className="type-body font-medium text-foreground">{transactionTitle(transaction)}</p>
                          {transactionNote(transaction) && (
                            <p className="type-caption text-hint">{transactionNote(transaction)}</p>
                          )}
                        </div>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{amount(transaction)}</Table.Cell>
                    <Table.Cell>
                      <p className="type-body text-subtle">{date(transaction)}</p>
                    </Table.Cell>
                    <Table.Cell>
                      <Chip
                        className="capitalize"
                        color={transactionStatusColor[transactionStatus(transaction)]}
                        size="sm"
                        variant="secondary"
                      >
                        {transactionStatusLabel(transaction)}
                      </Chip>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <div className="block md:hidden divide-y divide-divider">
        {transactions.map(transaction => (
          <div key={transaction.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {typeIcon(transaction, 'flex h-8 w-8 items-center justify-center rounded-lg bg-default shrink-0')}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="type-body font-medium text-foreground truncate">{transactionTitle(transaction)}</p>
                  {transactionNote(transaction) && (
                    <p className="type-caption text-hint truncate">{transactionNote(transaction)}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 type-caption">
                    <p className="text-hint">{date(transaction)}</p>
                    <Chip
                      className="capitalize"
                      color={transactionStatusColor[transactionStatus(transaction)]}
                      size="sm"
                      variant="tertiary"
                    >
                      {transactionStatusLabel(transaction)}
                    </Chip>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">{amount(transaction)}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
