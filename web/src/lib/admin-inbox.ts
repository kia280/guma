import { AuctionStatus, type AuctionItem } from '@/types/auction';
import type { BackpackItem } from '@/types/backpack';
import type { FundRequest, GuildBankItem, ItemRequest } from '@/types/guild-bank';

export const INBOX_KINDS = ['fund', 'item', 'auction', 'delivery', 'loot'] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export const REQUEST_KINDS: readonly InboxKind[] = ['fund', 'item'];

export const INBOX_STATUSES = ['open', 'approved', 'rejected', 'all'] as const;
export type InboxStatusFilter = (typeof INBOX_STATUSES)[number];
export type InboxEntryState = Exclude<InboxStatusFilter, 'all'>;

export const INBOX_SORTS = ['oldest', 'newest'] as const;
export type InboxSort = (typeof INBOX_SORTS)[number];

export type AuctionAttention = 'overdue' | 'notStarted' | 'endingWithoutBids';

export type LootGroup = { checkinId: string; title: string; items: GuildBankItem[]; oldest: string };

export type InboxEntry =
  | { kind: 'fund'; request: FundRequest }
  | { kind: 'item'; request: ItemRequest }
  | { kind: 'auction'; auction: AuctionItem; reason: AuctionAttention }
  | { kind: 'delivery'; delivery: BackpackItem }
  | { kind: 'loot'; group: LootGroup };

export type InboxEntryOf<K extends InboxKind> = Extract<InboxEntry, { kind: K }>;

export type ReviewableRequest = InboxEntryOf<'fund' | 'item'>;

interface InboxKindMeta<K extends InboxKind> {
  icon: string;
  id: (entry: InboxEntryOf<K>) => string;
  since: (entry: InboxEntryOf<K>) => string;
  state: (entry: InboxEntryOf<K>) => InboxEntryState;
  searchText: (entry: InboxEntryOf<K>) => Array<string | undefined>;
}

export const INBOX_KIND_META: { [K in InboxKind]: InboxKindMeta<K> } = {
  fund: {
    icon: 'solar:dollar-minimalistic-linear',
    id: entry => entry.request.id,
    since: entry => entry.request.createdAt,
    state: entry => (entry.request.status === 'pending' ? 'open' : entry.request.status),
    searchText: entry => [entry.request.requesterName, entry.request.reason],
  },
  item: {
    icon: 'solar:box-linear',
    id: entry => entry.request.id,
    since: entry => entry.request.createdAt,
    state: entry => (entry.request.status === 'pending' ? 'open' : entry.request.status),
    searchText: entry => [entry.request.requesterName, entry.request.itemName, entry.request.reason],
  },
  auction: {
    icon: 'solar:sledgehammer-linear',
    id: entry => entry.auction.id,
    since: entry => (entry.reason === 'notStarted' ? entry.auction.startTime : entry.auction.endTime),
    state: () => 'open',
    searchText: entry => [entry.auction.name, entry.auction.currentBidder?.username],
  },
  delivery: {
    icon: 'solar:box-minimalistic-linear',
    id: entry => entry.delivery.id,
    since: entry => entry.delivery.deliveryRequestedAt ?? entry.delivery.acquiredAt,
    state: () => 'open',
    searchText: entry => [entry.delivery.ownerName, entry.delivery.item.name],
  },
  loot: {
    icon: 'solar:clipboard-check-linear',
    id: entry => entry.group.checkinId,
    since: entry => entry.group.oldest,
    state: () => 'open',
    searchText: entry => [entry.group.title, ...entry.group.items.map(item => item.name)],
  },
};

const metaOf = <K extends InboxKind>(entry: InboxEntryOf<K>) => INBOX_KIND_META[entry.kind] as unknown as InboxKindMeta<K>;

export const entryKey = (entry: InboxEntry) => `${entry.kind}:${metaOf(entry).id(entry)}`;
export const entrySince = (entry: InboxEntry) => metaOf(entry).since(entry);
export const entryState = (entry: InboxEntry) => metaOf(entry).state(entry);

export const isReviewable = (entry: InboxEntry): entry is ReviewableRequest =>
  (entry.kind === 'fund' || entry.kind === 'item') && entry.request.status === 'pending';

export const matchesQuery = (entry: InboxEntry, query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return metaOf(entry)
    .searchText(entry)
    .some(text => text?.toLocaleLowerCase().includes(needle));
};

export const matchesStatus = (entry: InboxEntry, status: InboxStatusFilter) =>
  status === 'all' || entryState(entry) === status;

export const matchesKinds = (entry: InboxEntry, kinds: readonly InboxKind[]) =>
  kinds.length === 0 || kinds.includes(entry.kind);

export const sortEntries = (entries: InboxEntry[], sort: InboxSort) => {
  const direction = sort === 'oldest' ? 1 : -1;
  return [...entries].sort(
    (a, b) => direction * entrySince(a).localeCompare(entrySince(b)) || entryKey(a).localeCompare(entryKey(b)),
  );
};

const HOUR_MS = 60 * 60 * 1000;
const ENDING_SOON_MS = 24 * HOUR_MS;
const START_GRACE_MS = 5 * 60 * 1000;

export const auctionAttention = (auction: AuctionItem, now: number): AuctionAttention | null => {
  const start = new Date(auction.startTime).getTime();
  const end = new Date(auction.endTime).getTime();
  if (auction.status === AuctionStatus.ACTIVE && end <= now) return 'overdue';
  if (auction.status === AuctionStatus.UPCOMING && start + START_GRACE_MS <= now) return 'notStarted';
  if (auction.status === AuctionStatus.ACTIVE && !auction.currentBidder && end - now <= ENDING_SOON_MS) {
    return 'endingWithoutBids';
  }
  return null;
};

export const groupLoot = (items: GuildBankItem[]): LootGroup[] => {
  const groups = new Map<string, LootGroup>();
  items.forEach(item => {
    if (!item.checkinId) return;
    const group = groups.get(item.checkinId) ?? {
      checkinId: item.checkinId,
      title: item.checkinTitle ?? '',
      items: [],
      oldest: item.donatedAt,
    };
    group.items.push(item);
    if (item.donatedAt < group.oldest) group.oldest = item.donatedAt;
    groups.set(item.checkinId, group);
  });
  return [...groups.values()];
};

export interface InboxFilters {
  kinds: InboxKind[];
  status: InboxStatusFilter;
  query: string;
  sort: InboxSort;
}

type SearchParamsLike = { get(name: string): string | null };

export const defaultSort = (status: InboxStatusFilter): InboxSort => (status === 'open' ? 'oldest' : 'newest');

export const parseInboxFilters = (params: SearchParamsLike): InboxFilters => {
  const kinds = (params.get('type') ?? '')
    .split(',')
    .filter((kind): kind is InboxKind => (INBOX_KINDS as readonly string[]).includes(kind));
  const status = INBOX_STATUSES.find(value => value === params.get('status')) ?? 'open';
  const sort = INBOX_SORTS.find(value => value === params.get('sort')) ?? defaultSort(status);
  return {
    kinds: INBOX_KINDS.filter(kind => kinds.includes(kind)),
    status,
    query: params.get('q') ?? '',
    sort,
  };
};

export const INBOX_FILTER_PARAMS = ['type', 'status', 'q', 'sort'] as const;

export const searchString = (params: URLSearchParams) => params.toString().replace(/%2C/g, ',');

export const writeInboxFilters = (params: URLSearchParams, filters: InboxFilters) => {
  INBOX_FILTER_PARAMS.forEach(name => params.delete(name));
  if (filters.kinds.length > 0 && filters.kinds.length < INBOX_KINDS.length) params.set('type', filters.kinds.join(','));
  if (filters.status !== 'open') params.set('status', filters.status);
  if (filters.query.trim()) params.set('q', filters.query);
  if (filters.sort !== defaultSort(filters.status)) params.set('sort', filters.sort);
  return params;
};

export const LEGACY_REQUESTS_TAB = 'bankRequests';

export const legacyInboxHref = (params: SearchParamsLike) => {
  if (params.get('tab') !== LEGACY_REQUESTS_TAB) return null;
  const next = new URLSearchParams({ tab: 'inbox', type: REQUEST_KINDS.join(',') });
  const requestId = params.get('request');
  if (requestId) next.set('request', requestId);
  return `/dashboard/admin?${searchString(next)}`;
};
