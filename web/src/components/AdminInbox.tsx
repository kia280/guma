'use client';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Drawer,
  Label,
  Link,
  ListBox,
  SearchField,
  Select,
  Tag,
  TagGroup,
  cn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent, ListSkeleton } from '@/components/AsyncContent';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ItemThumbnail, getRarityColor } from '@/components/ItemThumbnail';
import { RequestReviewDialog, type ReviewTarget } from '@/components/RequestReviewDialog';
import { useLiveResource } from '@/hooks/useLiveResource';
import { useNow } from '@/hooks/useNow';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useIntlFormatter } from '@/i18n/useIntlFormatter';
import {
  INBOX_KINDS,
  INBOX_KIND_META,
  INBOX_SORTS,
  INBOX_STATUSES,
  auctionAttention,
  defaultSort,
  entryKey,
  entrySince,
  entryState,
  groupLoot,
  isReviewable,
  matchesKinds,
  matchesQuery,
  matchesStatus,
  parseInboxFilters,
  searchString,
  sortEntries,
  writeInboxFilters,
  type InboxEntry,
  type InboxFilters,
  type InboxKind,
  type LootGroup,
  type ReviewableRequest,
} from '@/lib/admin-inbox';
import { apiClient } from '@/lib/guma';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { LiveResource } from '@/lib/live-events';
import { requestStatusColor } from '@/lib/status-colors';
import type { AuctionItem } from '@/types/auction';
import type { BackpackItem } from '@/types/backpack';
import type { ReviewDecision } from '@/types/guild-bank';

type LoadStatus = 'loading' | 'ready' | 'error';

type SourceKey = 'requests' | 'auctions' | 'deliveries' | 'loot';

const INBOX_PAGE_SIZE = 100;
const LIST_PAGE_SIZE = 20;

const loadRequests = async (guildId: string): Promise<ReviewableRequest[]> => {
  const [pendingFunds, pendingItems, funds, items] = await Promise.all([
    apiClient.listFundRequests(guildId, 'pending'),
    apiClient.listItemRequests(guildId, 'pending'),
    apiClient.listFundRequests(guildId),
    apiClient.listItemRequests(guildId),
  ]);
  const merged = new Map<string, ReviewableRequest>();
  [...funds, ...pendingFunds].forEach(request => merged.set(`fund:${request.id}`, { kind: 'fund', request }));
  [...items, ...pendingItems].forEach(request => merged.set(`item:${request.id}`, { kind: 'item', request }));
  return [...merged.values()];
};

const loadAuctions = async (guildId: string): Promise<AuctionItem[]> => {
  const [active, upcoming] = await Promise.all([
    apiClient.listAuctions(guildId, { status: 'ACTIVE', pageSize: INBOX_PAGE_SIZE }),
    apiClient.listAuctions(guildId, { status: 'UPCOMING', pageSize: INBOX_PAGE_SIZE }),
  ]);
  return [...active, ...upcoming];
};

const loadDeliveries = (guildId: string): Promise<BackpackItem[]> => apiClient.listPendingDeliveries(guildId);

const loadLoot = async (guildId: string): Promise<LootGroup[]> =>
  groupLoot((await apiClient.listBankItems(guildId)).filter(item => item.rollCallId && !item.lock));

const SOURCE_KINDS: Record<SourceKey, readonly InboxKind[]> = {
  requests: ['fund', 'item'],
  auctions: ['auction'],
  deliveries: ['delivery'],
  loot: ['loot'],
};

function useInboxSource<T>(
  guildId: string,
  load: (guildId: string) => Promise<T[]>,
  resources: readonly LiveResource[],
) {
  const [state, setState] = React.useState<{ guildId: string; status: LoadStatus; data: T[] }>({
    guildId,
    status: 'loading',
    data: [],
  });
  const latest = React.useRef(0);

  const fetchData = React.useCallback(
    (background: boolean) => {
      const id = ++latest.current;
      load(guildId)
        .then(data => {
          if (id === latest.current) setState({ guildId, status: 'ready', data });
        })
        .catch(() => {
          if (id !== latest.current) return;
          setState(current =>
            background && current.guildId === guildId && current.status === 'ready'
              ? current
              : { guildId, status: 'error', data: [] },
          );
        });
    },
    [guildId, load],
  );

  const reload = React.useCallback(() => {
    setState({ guildId, status: 'loading', data: [] });
    fetchData(false);
  }, [guildId, fetchData]);
  const refresh = React.useCallback(() => fetchData(true), [fetchData]);

  React.useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useLiveResource(resources, refresh, { guildId });

  const isCurrent = state.guildId === guildId;
  return {
    data: isCurrent ? state.data : [],
    status: isCurrent ? state.status : ('loading' as LoadStatus),
    reload,
    refresh,
  };
}

const BANK_RESOURCES: readonly LiveResource[] = ['bank'];
const AUCTION_RESOURCES: readonly LiveResource[] = ['auction'];
const DELIVERY_RESOURCES: readonly LiveResource[] = ['delivery'];

function FilterTags<K extends string>({
  label,
  options,
  selected,
  counts,
  mode,
  onChange,
  optionLabel,
}: {
  label: string;
  options: readonly K[];
  selected: readonly K[];
  counts: Record<K, number | null>;
  mode: 'single' | 'multiple';
  onChange: (next: K[]) => void;
  optionLabel: (option: K) => string;
}) {
  return (
    <TagGroup
      size="lg"
      selectionMode={mode}
      disallowEmptySelection={mode === 'single'}
      selectedKeys={new Set(selected)}
      onSelectionChange={keys => {
        const next = keys === 'all' ? [...options] : options.filter(option => keys.has(option));
        onChange(next);
      }}
      className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3"
    >
      <Label className="type-label text-soft sm:w-16 sm:shrink-0">{label}</Label>
      <TagGroup.List className="flex flex-wrap gap-1.5">
        {options.map(option => (
          <Tag key={option} id={option} textValue={optionLabel(option)}>
            <span>{optionLabel(option)}</span>
            {counts[option] !== null && <span className="tabular-nums opacity-70">{counts[option]}</span>}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}

function IconTile({ icon, tone = 'default' }: { icon: string; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tone === 'default' && 'bg-default text-subtle',
        tone === 'warning' && 'bg-warning/10 text-warning',
        tone === 'danger' && 'bg-danger/10 text-danger',
      )}
    >
      <Icon icon={icon} width={20} aria-hidden />
    </div>
  );
}

interface InboxRowProps {
  entry: InboxEntry;
  now: number;
  showSelection: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  onSelect: (isSelected: boolean) => void;
  onReview: (entry: ReviewableRequest, decision: ReviewDecision) => void;
  onDeliver: (delivery: BackpackItem) => void;
}

function InboxRow({ entry, now, showSelection, isSelected, isHighlighted, onSelect, onReview, onDeliver }: InboxRowProps) {
  const t = useTranslations('adminInbox');
  const userName = useUserName();
  const format = useIntlFormatter();
  const formatGold = useFormatGold();
  const rowRef = React.useRef<HTMLLIElement>(null);

  React.useEffect(() => {
    if (isHighlighted) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [isHighlighted]);

  const relative = (value: string) => format.relativeTime(new Date(value), now);
  const kindLabel = t(`kinds.${entry.kind}`);
  const state = entryState(entry);

  let leading: React.ReactNode;
  let subject: string;
  let detail: React.ReactNode = null;
  let meta: string;
  let notes: React.ReactNode = null;
  let trailing: React.ReactNode;

  switch (entry.kind) {
    case 'fund':
    case 'item': {
      const { request } = entry;
      subject = userName(request.requesterName);
      leading =
        entry.kind === 'fund' ? (
          <IconTile icon={INBOX_KIND_META.fund.icon} tone="warning" />
        ) : (
          <ItemThumbnail category={entry.request.itemCategory} rarity={entry.request.itemRarity} />
        );
      detail =
        entry.kind === 'fund' ? (
          <p className="type-body text-foreground tabular-nums">{formatGold(entry.request.amount)}</p>
        ) : (
          <div className="flex min-w-0 items-center gap-2 type-body">
            <p className="text-foreground truncate">{entry.request.itemName || t('unknownItem')}</p>
            <Chip size="sm" variant="secondary" color={getRarityColor(entry.request.itemRarity)} className="capitalize">
              {entry.request.itemRarity}
            </Chip>
          </div>
        );
      meta =
        state === 'open'
          ? relative(request.createdAt)
          : format.dateTime(new Date(request.createdAt), { dateStyle: 'medium', timeStyle: 'short' });
      notes = (
        <>
          {request.reason && <p className="type-body text-subtle break-words">{request.reason}</p>}
          {request.reviewNote && (
            <p className="type-caption text-hint break-words">{t('reviewNote', { note: request.reviewNote })}</p>
          )}
        </>
      );
      trailing =
        request.status === 'pending' ? (
          <>
            <Button size="sm" variant="secondary" onPress={() => onReview(entry, 'rejected')}>
              {t('reject')}
            </Button>
            <Button size="sm" variant="primary" onPress={() => onReview(entry, 'approved')}>
              {t('approve')}
            </Button>
          </>
        ) : (
          <Chip size="sm" variant="secondary" color={requestStatusColor[request.status]}>
            {t(`statuses.${request.status}`)}
          </Chip>
        );
      break;
    }
    case 'auction': {
      const { auction, reason } = entry;
      subject = auction.name;
      leading = <IconTile icon={INBOX_KIND_META.auction.icon} tone={reason === 'endingWithoutBids' ? 'warning' : 'danger'} />;
      detail = (
        <p className="type-body text-subtle">
          {t(`auctionReasonDetail.${reason}`, { time: relative(entrySince(entry)) })}
        </p>
      );
      meta = t(`auctionReason.${reason}`);
      trailing = (
        <Link href={`/dashboard/auction/${auction.id}`} className="text-accent">
          {t('openAuction')}
        </Link>
      );
      break;
    }
    case 'delivery': {
      const { delivery } = entry;
      subject = userName(delivery.ownerName);
      leading = <ItemThumbnail category={delivery.item.category} rarity={delivery.item.rarity} imageUrl={delivery.item.imageUrl} />;
      detail = <p className="type-body text-foreground truncate">{delivery.item.name}</p>;
      meta = t('deliveryRequested', { time: relative(entrySince(entry)) });
      trailing = (
        <Button size="sm" variant="secondary" onPress={() => onDeliver(delivery)}>
          {t('confirmDelivery')}
        </Button>
      );
      break;
    }
    case 'loot': {
      const { group } = entry;
      subject = group.title || t('untitledRollCall');
      leading = <IconTile icon={INBOX_KIND_META.loot.icon} />;
      detail = (
        <p className="type-body text-subtle truncate">
          {t('lootItems', { count: group.items.length, items: group.items.map(item => item.name).join(', ') })}
        </p>
      );
      meta = t('lootWaiting', { time: relative(group.oldest) });
      trailing = (
        <Link href={`/dashboard/roll-calls/${group.rollCallId}`} className="text-accent">
          {t('openRollCall')}
        </Link>
      );
      break;
    }
  }

  return (
    <li
      ref={rowRef}
      className={cn(
        'flex flex-col gap-3 rounded-lg bg-surface-secondary px-3 py-3 sm:flex-row sm:items-center',
        isHighlighted && 'ring-2 ring-accent',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {showSelection && (
          <div className="flex w-5 shrink-0 justify-center">
            {isReviewable(entry) && (
              <Checkbox
                aria-label={t('selectRequest', { name: subject, kind: kindLabel })}
                isSelected={isSelected}
                onChange={onSelect}
              >
                <Checkbox.Content>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox.Content>
              </Checkbox>
            )}
          </div>
        )}
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="type-body font-medium text-foreground truncate">{subject}</p>
          {detail}
          <p className="type-caption text-hint">
            {kindLabel}
            <span aria-hidden> · </span>
            {meta}
          </p>
          {notes}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-end type-body sm:self-center">{trailing}</div>
    </li>
  );
}

export function AdminInbox({ guildId }: { guildId: string }) {
  const t = useTranslations('adminInbox');
  const userName = useUserName();
  const notify = useToast();
  const now = useNow(60 * 1000);
  const searchParams = useSearchParams();
  const filters = parseInboxFilters(searchParams);
  const focusId = searchParams.get('request');

  const requests = useInboxSource(guildId, loadRequests, BANK_RESOURCES);
  const auctions = useInboxSource(guildId, loadAuctions, AUCTION_RESOURCES);
  const deliveries = useInboxSource(guildId, loadDeliveries, DELIVERY_RESOURCES);
  const loot = useInboxSource(guildId, loadLoot, BANK_RESOURCES);
  const sources: Record<SourceKey, { status: LoadStatus; reload: () => void }> = { requests, auctions, deliveries, loot };

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reviewTarget, setReviewTarget] = React.useState<ReviewTarget | null>(null);
  const [deliveryTarget, setDeliveryTarget] = React.useState<BackpackItem | null>(null);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);
  const focusHandled = React.useRef<string | null>(null);
  const [page, setPage] = React.useState({ signature: '', limit: LIST_PAGE_SIZE });

  const setFilters = React.useCallback((patch: Partial<InboxFilters>) => {
    const params = new URLSearchParams(window.location.search);
    writeInboxFilters(params, { ...parseInboxFilters(params), ...patch });
    window.history.replaceState(null, '', `?${searchString(params)}`);
  }, []);

  const entries = React.useMemo<InboxEntry[]>(
    () => [
      ...requests.data,
      ...auctions.data.flatMap(auction => {
        const reason = auctionAttention(auction, now);
        return reason ? [{ kind: 'auction' as const, auction, reason }] : [];
      }),
      ...deliveries.data.map(delivery => ({ kind: 'delivery' as const, delivery })),
      ...loot.data.map(group => ({ kind: 'loot' as const, group })),
    ],
    [requests.data, auctions.data, deliveries.data, loot.data, now],
  );

  const searchable = entries.filter(entry => matchesQuery(entry, filters.query));
  const visible = sortEntries(
    searchable.filter(entry => matchesStatus(entry, filters.status) && matchesKinds(entry, filters.kinds)),
    filters.sort,
  );

  const sourceOfKind = (kind: InboxKind) =>
    (Object.keys(SOURCE_KINDS) as SourceKey[]).find(key => SOURCE_KINDS[key].includes(kind))!;
  const isKindReady = (kind: InboxKind) => sources[sourceOfKind(kind)].status === 'ready';

  const kindCounts = Object.fromEntries(
    INBOX_KINDS.map(kind => [
      kind,
      isKindReady(kind)
        ? searchable.filter(entry => entry.kind === kind && matchesStatus(entry, filters.status)).length
        : null,
    ]),
  ) as Record<InboxKind, number | null>;
  const statusCounts = Object.fromEntries(
    INBOX_STATUSES.map(status => [
      status,
      searchable.filter(entry => matchesKinds(entry, filters.kinds) && matchesStatus(entry, status)).length,
    ]),
  ) as Record<(typeof INBOX_STATUSES)[number], number>;

  const relevantSources = (Object.keys(SOURCE_KINDS) as SourceKey[]).filter(key =>
    SOURCE_KINDS[key].some(kind => filters.kinds.length === 0 || filters.kinds.includes(kind)),
  );
  const failedSources = relevantSources.filter(key => sources[key].status === 'error');
  const isLoading = relevantSources.some(key => sources[key].status === 'loading');

  React.useEffect(() => {
    if (!focusId || focusHandled.current === focusId || requests.status !== 'ready') return;
    focusHandled.current = focusId;
    const entry = requests.data.find(candidate => candidate.request.id === focusId);
    if (!entry) return;
    const next = { ...filters };
    if (!matchesStatus(entry, next.status)) {
      next.status = entryState(entry);
      next.sort = defaultSort(next.status);
    }
    if (!matchesKinds(entry, next.kinds)) next.kinds = [...next.kinds, entry.kind];
    if (!matchesQuery(entry, next.query)) next.query = '';
    if (next.status !== filters.status || next.kinds !== filters.kinds || next.query !== filters.query) setFilters(next);
  }, [focusId, requests.status, requests.data, filters, setFilters]);

  const signature = `${filters.kinds.join(',')}|${filters.status}|${filters.query}|${filters.sort}`;
  const isFocused = (entry: InboxEntry) =>
    !!focusId && (entry.kind === 'fund' || entry.kind === 'item') && entry.request.id === focusId;
  const focusIndex = visible.findIndex(isFocused);
  const limit = Math.max(page.signature === signature ? page.limit : LIST_PAGE_SIZE, focusIndex + 1);
  const shown = visible.slice(0, limit);

  const selectable = visible.filter(isReviewable);
  const selectedRequests = selectable.filter(entry => selected.has(entryKey(entry)));
  const allSelected = selectable.length > 0 && selectedRequests.length === selectable.length;

  const toggleOne = (key: string, isSelected: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      if (isSelected) next.add(key);
      else next.delete(key);
      return next;
    });
  const toggleAll = (isSelected: boolean) =>
    setSelected(current => {
      const next = new Set(current);
      selectable.forEach(entry => (isSelected ? next.add(entryKey(entry)) : next.delete(entryKey(entry))));
      return next;
    });

  const handleReviewed = (keys: string[]) => {
    setSelected(current => new Set([...current].filter(key => !keys.includes(key))));
    requests.refresh();
    loot.refresh();
  };

  const confirmDelivery = async () => {
    if (!deliveryTarget) return;
    try {
      await apiClient.confirmBackpackDelivery(guildId, deliveryTarget.id);
    } finally {
      deliveries.refresh();
    }
    notify.success(t('deliveryConfirmed', { item: deliveryTarget.item.name, name: userName(deliveryTarget.ownerName) }));
  };

  const activeFilterCount =
    (filters.kinds.length > 0 ? 1 : 0) + (filters.status !== 'open' ? 1 : 0) + (filters.sort !== defaultSort(filters.status) ? 1 : 0);
  const hasFilters = filters.kinds.length > 0 || filters.status !== 'open' || filters.query.trim() !== '';
  const clearFilters = () => setFilters({ kinds: [], status: 'open', query: '', sort: 'oldest' });

  const statusControl = (
    <FilterTags
      label={t('filters.status')}
      options={INBOX_STATUSES}
      selected={[filters.status]}
      counts={statusCounts}
      mode="single"
      onChange={([status]) => status && setFilters({ status, sort: defaultSort(status) })}
      optionLabel={status => t(`filters.statuses.${status}`)}
    />
  );
  const kindControl = (
    <FilterTags
      label={t('filters.type')}
      options={INBOX_KINDS}
      selected={filters.kinds}
      counts={kindCounts}
      mode="multiple"
      onChange={kinds => setFilters({ kinds: kinds.length === INBOX_KINDS.length ? [] : kinds })}
      optionLabel={kind => t(`kinds.${kind}`)}
    />
  );
  const sortControl = (
    <Select
      aria-label={t('filters.sort')}
      value={filters.sort}
      onChange={value => value && setFilters({ sort: value as InboxFilters['sort'] })}
      className="sm:w-40"
    >
      <Label className="sm:sr-only">{t('filters.sort')}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {INBOX_SORTS.map(sort => (
            <ListBox.Item key={sort} id={sort} textValue={t(`filters.sorts.${sort}`)}>
              {t(`filters.sorts.${sort}`)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );

  const singleKind = filters.kinds.length === 1 ? filters.kinds[0] : null;
  const emptyState =
    filters.query.trim() || (filters.kinds.length > 1 && filters.status !== 'open')
      ? { icon: 'solar:magnifer-linear', title: t('empty.noMatches'), description: t('empty.noMatchesHint') }
      : filters.status === 'open'
        ? singleKind
          ? { icon: INBOX_KIND_META[singleKind].icon, title: t(`empty.open.${singleKind}`) }
          : { icon: 'solar:check-circle-linear', title: t('empty.allClear'), description: t('empty.allClearHint') }
        : { icon: 'solar:history-linear', title: t(`empty.history.${filters.status}`) };

  return (
    <Card className="border border-transparent shadow-edge bg-surface">
      <Card.Header className="flex flex-col gap-3 border-b border-divider pb-4">
        <div className="flex items-end gap-2">
          <SearchField
            aria-label={t('filters.search')}
            value={filters.query}
            onChange={query => setFilters({ query })}
            variant="secondary"
            className="min-w-0 flex-1"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder={t('filters.searchPlaceholder')} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <div className="hidden sm:block">{sortControl}</div>
          <Button
            variant="secondary"
            className="sm:hidden"
            aria-label={t('filters.openLabel', { count: activeFilterCount })}
            onPress={() => setIsFilterDrawerOpen(true)}
          >
            <Icon icon="solar:filter-linear" width={18} aria-hidden />
            {t('filters.open')}
            {activeFilterCount > 0 && (
              <Chip size="sm" color="accent" aria-hidden>
                {activeFilterCount}
              </Chip>
            )}
          </Button>
        </div>
        <div className="hidden flex-col gap-2 sm:flex">
          {statusControl}
          {kindControl}
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 type-caption text-hint sm:hidden" aria-live="polite">
            <span>{t('filters.summary', { count: visible.length })}</span>
            <button
              type="button"
              className="shrink-0 rounded type-body text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              onClick={clearFilters}
            >
              {t('filters.clear')}
            </button>
          </div>
        )}
      </Card.Header>

      <Card.Content className="flex flex-col gap-3 pt-4">
        {failedSources.map(key => (
          <Alert key={key} status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>{t(`loadFailed.${key}`)}</Alert.Title>
            </Alert.Content>
            <Button size="sm" variant="secondary" onPress={sources[key].reload}>
              {t('retry')}
            </Button>
          </Alert>
        ))}

        {selectable.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2">
            <Checkbox isSelected={allSelected} isIndeterminate={selectedRequests.length > 0 && !allSelected} onChange={toggleAll}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Label className="type-body text-soft">
                  {selectedRequests.length > 0
                    ? t('selectedCount', { count: selectedRequests.length })
                    : t('selectAll', { count: selectable.length })}
                </Label>
              </Checkbox.Content>
            </Checkbox>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={selectedRequests.length === 0}
                onPress={() => setReviewTarget({ decision: 'rejected', requests: selectedRequests })}
              >
                {t('rejectSelected', { count: selectedRequests.length })}
              </Button>
              <Button
                size="sm"
                variant="primary"
                isDisabled={selectedRequests.length === 0}
                onPress={() => setReviewTarget({ decision: 'approved', requests: selectedRequests })}
              >
                {t('approveSelected', { count: selectedRequests.length })}
              </Button>
            </div>
          </div>
        )}

        {isLoading && visible.length === 0 ? (
          <ListSkeleton rows={4} />
        ) : visible.length === 0 ? (
          failedSources.length === relevantSources.length ? null : (
            <div className="flex flex-col items-center">
              <EmptyContent {...emptyState} />
              {hasFilters && (
                <Button size="sm" variant="secondary" onPress={clearFilters}>
                  {t('filters.clear')}
                </Button>
              )}
            </div>
          )
        ) : (
          <ul className="flex flex-col gap-2" aria-busy={isLoading}>
            {shown.map(entry => {
              const key = entryKey(entry);
              return (
                <InboxRow
                  key={key}
                  entry={entry}
                  now={now}
                  showSelection={selectable.length > 0}
                  isSelected={selected.has(key)}
                  isHighlighted={isFocused(entry)}
                  onSelect={value => toggleOne(key, value)}
                  onReview={(request, decision) => setReviewTarget({ decision, requests: [request] })}
                  onDeliver={setDeliveryTarget}
                />
              );
            })}
          </ul>
        )}

        {shown.length < visible.length && (
          <div className="flex flex-col items-center gap-2 pt-1">
            <p className="type-caption text-hint">{t('showing', { shown: shown.length, total: visible.length })}</p>
            <Button size="sm" variant="secondary" onPress={() => setPage({ signature, limit: limit + LIST_PAGE_SIZE })}>
              {t('showMore')}
            </Button>
          </div>
        )}
      </Card.Content>

      <Drawer.Backdrop isOpen={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
        <Drawer.Content placement="bottom">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading>{t('filters.title')}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="flex flex-col gap-4">
              {statusControl}
              {kindControl}
              {sortControl}
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="secondary" onPress={clearFilters} isDisabled={!hasFilters && activeFilterCount === 0}>
                {t('filters.clear')}
              </Button>
              <Button slot="close" variant="primary">
                {t('filters.showResults', { count: visible.length })}
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <RequestReviewDialog
        guildId={guildId}
        target={reviewTarget}
        onClose={() => setReviewTarget(null)}
        onReviewed={handleReviewed}
      />

      <ConfirmDialog
        heading={t('confirmDeliveryTitle', { item: deliveryTarget?.item.name ?? '' })}
        body={t('confirmDeliveryBody', {
          item: deliveryTarget?.item.name ?? '',
          name: userName(deliveryTarget?.ownerName),
        })}
        confirmLabel={t('confirmDelivery')}
        failedMessage={t('confirmDeliveryFailed')}
        status="warning"
        isOpen={deliveryTarget !== null}
        onOpenChange={open => {
          if (!open) setDeliveryTarget(null);
        }}
        onConfirm={confirmDelivery}
      />
    </Card>
  );
}
