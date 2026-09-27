const MINOR_UNITS_PER_GOLD = 100;

export const GOLD_STEP = 1 / MINOR_UNITS_PER_GOLD;

export const GOLD_FORMAT_OPTIONS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const satisfies Intl.NumberFormatOptions;

export const toMinorUnits = (gold: number): number => Math.round(gold * MINOR_UNITS_PER_GOLD);

export const fromMinorUnits = (minor: number | string | undefined): number =>
  Number(minor ?? 0) / MINOR_UNITS_PER_GOLD;

export const roundGold = (gold: number): number => fromMinorUnits(toMinorUnits(gold));

export const parseGold = (input: string): number => roundGold(Number.parseFloat(input));
