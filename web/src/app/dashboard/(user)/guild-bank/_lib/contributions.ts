import type { GuildContribution } from '@/types/guild-bank';

export const NOTE_MAX_LENGTH = 200;
export const REASON_MAX_LENGTH = 500;

export const getContributionIcon = (type: GuildContribution['type']) => {
  switch (type) {
    case 'contribute':
      return 'solar:arrow-down-linear';
    case 'request':
      return 'solar:arrow-up-linear';
    case 'item_donate':
      return 'solar:backpack-linear';
    case 'item_distribute':
      return 'solar:arrow-right-linear';
    case 'roll_call_loot':
      return 'solar:clipboard-check-linear';
    case 'auction_proceeds':
      return 'solar:sledgehammer-linear';
    case 'raffle_revenue':
      return 'solar:ticket-linear';
    case 'roll_call_gold_payout':
      return 'solar:hand-money-linear';
    case 'roll_call_gold_retracted':
      return 'solar:undo-left-linear';
    case 'roll_call_gold_kept':
      return 'solar:safe-2-linear';
    case 'admin_transfer':
      return 'solar:shield-user-linear';
  }
};

export const isInflowContribution = (type: GuildContribution['type']) =>
  type === 'contribute' ||
  type === 'auction_proceeds' ||
  type === 'raffle_revenue' ||
  type === 'roll_call_loot' ||
  type === 'admin_transfer';

export const isBalanceNeutralContribution = (type: GuildContribution['type']) => type === 'roll_call_gold_kept';

export const isSettledContribution = (status: GuildContribution['status']) =>
  status === 'completed' || status === 'approved';
