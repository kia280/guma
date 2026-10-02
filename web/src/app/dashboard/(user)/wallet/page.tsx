'use client';

import React from 'react';
import { useCurrentGuildId } from '@/lib/current-guild';
import { BackpackCard } from './_components/BackpackCard';
import { BalanceCard } from './_components/BalanceCard';
import { DepositModal } from './_components/DepositModal';
import { PendingWithdrawalsList } from './_components/PendingWithdrawalsList';
import { TransactionHistoryCard } from './_components/TransactionHistoryCard';
import { TransferModal } from './_components/TransferModal';
import { WithdrawModal } from './_components/WithdrawModal';
import { useWalletData } from './_hooks/useWalletData';

export default function WalletPage() {
  const guildId = useCurrentGuildId();
  const data = useWalletData(guildId);
  const balance = data.wallet?.balance ?? 0;

  return (
    <div className="space-y-5">
      <BalanceCard
        wallet={data.wallet}
        walletState={data.walletState}
        balanceTrend={data.balanceTrend}
        actions={
          <>
            <DepositModal guildId={guildId} balance={balance} onCompleted={data.refetchWallet} />
            <TransferModal
              guildId={guildId}
              balance={balance}
              members={data.members}
              onCompleted={data.refetchWallet}
              onFailed={data.refetchBalance}
            />
            <WithdrawModal
              guildId={guildId}
              balance={balance}
              onCompleted={data.refetchWallet}
              onFailed={data.refetchBalance}
            />
          </>
        }
        pendingWithdrawals={
          <PendingWithdrawalsList
            guildId={guildId}
            requests={data.pendingWithdrawals}
            onSettled={data.refetchBalance}
          />
        }
      />
      <BackpackCard
        guildId={guildId}
        items={data.backpackItems}
        loadState={data.backpackState}
        members={data.members}
        onRetry={data.reload}
        onItemsChanged={data.refetchBackpack}
        onItemWithdrawn={data.refetchWallet}
      />
      <TransactionHistoryCard
        guildId={guildId}
        transactions={data.transactions}
        pendingWithdrawals={data.pendingWithdrawals}
        loadState={data.transactionsState}
        onRetry={data.reload}
      />
    </div>
  );
}
