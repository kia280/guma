import { fromMinorUnits, toMinorUnits } from './money';

export type GoldAmounts = Record<string, number>;

export interface GoldAllocation {
  allocated: number;
  unallocated: number;
  isOverAllocated: boolean;
  hasPayout: boolean;
}

export interface EvenSplit {
  recipients: string[];
  share: number;
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

export const splitRemainderEvenly = (remaining: number, amounts: GoldAmounts, userIds: string[]): EvenSplit | null => {
  const recipients = userIds.filter(userId => amountInMinorUnits(amounts[userId]) === 0);
  const unallocatedMinor = toMinorUnits(summarizeAllocation(remaining, amounts).unallocated);
  if (recipients.length === 0 || unallocatedMinor <= 0) return null;
  const shareMinor = Math.floor(unallocatedMinor / recipients.length);
  if (shareMinor === 0) return null;
  return {
    recipients,
    share: fromMinorUnits(shareMinor),
    leftover: fromMinorUnits(unallocatedMinor - shareMinor * recipients.length),
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
