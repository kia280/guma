import type { RollCallFormValues } from '@/components/RollCallFormFields';
import type { ItemTemplate, LootEntry } from '@/types/roll-call';

export const DRAFT_KEY = 'roll_call_draft';

export interface RollCallDraft extends RollCallFormValues {
  lootInput: string;
  lootList: LootEntry[];
}

export const toLootEntry = (item: ItemTemplate): LootEntry => ({
  name: item.name,
  description: item.description || undefined,
  category: item.category,
  rarity: item.rarity,
});

const DEFAULT_WINDOW_MS = 12 * 60 * 60 * 1000;

export const currentMinute = () => {
  const now = new Date();
  now.setSeconds(0, 0);
  return now.toISOString();
};

export const defaultExpireTime = (datetime: string) =>
  new Date(new Date(datetime).getTime() + DEFAULT_WINDOW_MS).toISOString();

export const emptyDraft: RollCallDraft = {
  title: '',
  description: '',
  datetime: '',
  expireTime: '',
  imageUrl: '',
  lootInput: '',
  lootList: [],
};

export const readStoredDraft = (): RollCallDraft | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RollCallDraft> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      datetime: typeof parsed.datetime === 'string' ? parsed.datetime : '',
      expireTime: typeof parsed.expireTime === 'string' ? parsed.expireTime : '',
      imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl : '',
      lootInput: typeof parsed.lootInput === 'string' ? parsed.lootInput : '',
      lootList: Array.isArray(parsed.lootList) ? parsed.lootList : [],
    };
  } catch {
    return null;
  }
};
