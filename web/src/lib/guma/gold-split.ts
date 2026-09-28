import { fromMinorUnits, toMinorUnits } from './money';

export type GoldAmounts = Record<string, number>;

export interface GoldAllocation {
  allocated: number;
  unallocated: number;
  isOverAllocated: boolean;
  hasPayout: boolean;
}

export type GoldWeights = Record<string, number>;

export const DEFAULT_GOLD_WEIGHT = 1;

export const WEIGHT_FORMAT_OPTIONS = { maximumFractionDigits: 2 } as const satisfies Intl.NumberFormatOptions;

export interface WeightedSplit {
  shares: GoldAmounts;
  totalWeight: number;
  leftover: number;
}

const amountInMinorUnits = (amount: number | undefined): number =>
  amount !== undefined && Number.isFinite(amount) && amount > 0 ? toMinorUnits(amount) : 0;

export const summarizeAllocation = (remaining: number, amounts: GoldAmounts): GoldAllocation => {
  const allocatedMinor = Object.values(amounts).reduce((sum, amount) => sum + amountInMinorUnits(amount), 0);
  const unallocatedMinor = toMinorUnits(remaining) - allocatedMinor;
  return {
    allocated: fromMinorUnits(allocatedMinor),
    unallocated: fromMinorUnits(unallocatedMinor),
    isOverAllocated: unallocatedMinor < 0,
    hasPayout: allocatedMinor > 0,
  };
};

export const weightOf = (weights: GoldWeights, userId: string): number => {
  const weight = weights[userId];
  return weight !== undefined && Number.isFinite(weight) && weight >= 0 ? weight : DEFAULT_GOLD_WEIGHT;
};

const weightUnits = (weight: number): bigint => BigInt(Math.round(weight * 100));

export const splitRemainderByWeight = (
  remaining: number,
  amounts: GoldAmounts,
  weights: GoldWeights,
  userIds: string[],
): WeightedSplit | null => {
  const recipients = userIds.filter(
    userId => amountInMinorUnits(amounts[userId]) === 0 && weightUnits(weightOf(weights, userId)) > BigInt(0),
  );
  const unallocatedMinor = BigInt(toMinorUnits(summarizeAllocation(remaining, amounts).unallocated));
  if (recipients.length === 0 || unallocatedMinor <= BigInt(0)) return null;
  const totalUnits = recipients.reduce((sum, userId) => sum + weightUnits(weightOf(weights, userId)), BigInt(0));
  let distributedMinor = BigInt(0);
  const shares: GoldAmounts = {};
  for (const userId of recipients) {
    const shareMinor = (unallocatedMinor * weightUnits(weightOf(weights, userId))) / totalUnits;
    distributedMinor += shareMinor;
    shares[userId] = fromMinorUnits(Number(shareMinor));
  }
  if (distributedMinor === BigInt(0)) return null;
  return {
    shares,
    totalWeight: Number(totalUnits) / 100,
    leftover: fromMinorUnits(Number(unallocatedMinor - distributedMinor)),
  };
};

export const toGoldPayouts = (amounts: GoldAmounts) =>
  Object.entries(amounts)
    .filter(([, amount]) => amountInMinorUnits(amount) > 0)
    .map(([userId, amount]) => ({ userId, amount: fromMinorUnits(toMinorUnits(amount)) }));

export const newRequestId = (): string => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
