'use client';

import {
  Button,
  Checkbox,
  Chip,
  FieldError,
  Input,
  Label,
  Modal,
  Separator,
  Spinner,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useOverlayState,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { EmptyContent } from '@/components/AsyncContent';
import { useToast } from '@/hooks/useToast';
import { useUserName } from '@/hooks/useUserName';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { apiErrorCode, GrpcCode } from '@/lib/guma/errors';
import { GOLD_STEP, parseGold } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { isGuildRole, roleChipColor } from '@/lib/permissions';
import type { BackpackItem } from '@/types/backpack';
import type { MockUser } from '@/types/user';
import type { AssetDestination, MemberAssets } from '@/types/wallet';
import { ConfirmDialog } from './ConfirmDialog';
import { ItemHistoryModal } from './ItemHistoryModal';
import { ItemLockChip } from './ItemLockChip';
import { ItemThumbnail } from './ItemThumbnail';
import { MemberComboBox, type MemberOption } from './MemberComboBox';
import { MemberRoleField } from './MemberRoleField';
import { UserAvatar } from './UserAvatar';

const NOTE_MAX_LENGTH = 200;

type DestinationKind = AssetDestination['kind'];
type PendingTransfer = { kind: 'funds'; amount: number } | { kind: 'items'; itemIds: string[] };
type LoadResult = { userId: string; assets: MemberAssets | null };

const isMovable = (item: BackpackItem) => !item.lock && !item.deliveryRequestedAt;

type MemberAssetsModalProps = {
  state: UseOverlayStateReturn;
  member: MockUser | null;
  members: MockUser[];
  onTransferred: () => void;
  onRoleChanged: (member: MockUser) => void;
  onMembersStale: () => void;
};

export function MemberAssetsModal({
  state,
  member,
  members,
  onTransferred,
  onRoleChanged,
  onMembersStale,
}: MemberAssetsModalProps) {
  const t = useTranslations('memberAssets');
  const labels = useTranslations('createAuctionModal');
  const roleLabels = useTranslations('adminPage.roles');
  const userName = useUserName();
  const formatGold = useFormatGold();
  const notify = useToast();
  const guildId = useCurrentGuildId();
  const historyState = useOverlayState();
  const [historyItem, setHistoryItem] = React.useState<BackpackItem | null>(null);

  const [result, setResult] = React.useState<LoadResult | null>(null);
  const [destinationKind, setDestinationKind] = React.useState<DestinationKind>('member');
  const [recipientId, setRecipientId] = React.useState('');
  const [note, setNote] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [showFundErrors, setShowFundErrors] = React.useState(false);
  const [showItemErrors, setShowItemErrors] = React.useState(false);
  const [pending, setPending] = React.useState<PendingTransfer | null>(null);
  const [failure, setFailure] = React.useState<string | null>(null);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const memberId = member?.id ?? null;
  const openKey = state.isOpen ? memberId : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    setDestinationKind('member');
    setRecipientId('');
    setNote('');
    setAmount('');
    setSelected(new Set());
    setShowFundErrors(false);
    setShowItemErrors(false);
  }

  const load = React.useCallback(() => {
    if (!memberId) return;
    apiClient
      .getMemberAssets(guildId, memberId)
      .then(assets => setResult({ userId: memberId, assets }))
      .catch(() => setResult({ userId: memberId, assets: null }));
  }, [guildId, memberId]);

  React.useEffect(() => {
    if (state.isOpen) load();
  }, [state.isOpen, load]);

  const retry = () => {
    setResult(null);
    load();
  };

  const isCurrent = result !== null && result.userId === memberId;
  const status = !isCurrent ? 'loading' : result.assets === null ? 'error' : 'ready';
  const assets = isCurrent ? result.assets : null;
  const items = assets?.items ?? [];
  const movableIds = items.filter(isMovable).map(item => item.id);
  const selectedIds = movableIds.filter(id => selected.has(id));
  const allSelected = movableIds.length > 0 && selectedIds.length === movableIds.length;

  const memberName = member ? userName(member.username) : '';
  const recipientOptions = React.useMemo<MemberOption[]>(
    () =>
      members
        .filter(candidate => candidate.id !== memberId)
        .map(candidate => ({
          id: candidate.id,
          name: userName(candidate.username),
          avatar: candidate.avatar,
          description: isGuildRole(candidate.role) ? roleLabels(candidate.role) : undefined,
        })),
    [members, memberId, userName, roleLabels],
  );
  const recipientName = recipientOptions.find(option => option.id === recipientId)?.name ?? '';

  const destination: AssetDestination =
    destinationKind === 'bank' ? { kind: 'bank' } : { kind: 'member', userId: recipientId };
  const destinationLabel = destinationKind === 'bank' ? t('guildBank') : recipientName;

  const amountValue = parseGold(amount);
  const recipientError = destinationKind === 'member' && !recipientId ? t('recipientRequired') : null;
  const noteError = note.length > NOTE_MAX_LENGTH ? t('noteTooLong', { max: NOTE_MAX_LENGTH }) : null;
  const amountError = !(amountValue > 0)
    ? t('amountMustBePositive')
    : assets && amountValue > assets.balance
      ? t('amountExceedsBalance')
      : null;
  const itemsError = selectedIds.length === 0 ? t('selectItems') : null;
  const showRecipientError = Boolean(recipientError) && (showFundErrors || showItemErrors);

  const toggleAll = (value: boolean) => setSelected(value ? new Set(movableIds) : new Set());
  const toggleOne = (id: string, value: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const requestFunds = (trigger: Element) => {
    setShowFundErrors(true);
    if (amountError || recipientError || noteError) {
      focusFirstInvalidField(trigger);
      return;
    }
    setFailure(null);
    setPending({ kind: 'funds', amount: amountValue });
  };

  const requestItems = (trigger: Element) => {
    setShowItemErrors(true);
    if (itemsError || recipientError || noteError) {
      focusFirstInvalidField(trigger);
      return;
    }
    setFailure(null);
    setPending({ kind: 'items', itemIds: selectedIds });
  };

  const confirmTransfer = async () => {
    if (!memberId || !pending) return;
    const trimmedNote = note.trim() || undefined;
    try {
      if (pending.kind === 'funds') {
        await apiClient.adminTransferFunds(guildId, memberId, { destination, amount: pending.amount, note: trimmedNote });
        notify.success(t('fundsTransferred', { amount: formatGold(pending.amount), destination: destinationLabel }));
        setAmount('');
        setShowFundErrors(false);
      } else {
        await apiClient.adminTransferItems(guildId, memberId, { destination, itemIds: pending.itemIds, note: trimmedNote });
        notify.success(t('itemsTransferred', { count: pending.itemIds.length, destination: destinationLabel }));
        setSelected(new Set());
        setShowItemErrors(false);
      }
      load();
      onTransferred();
    } catch (err) {
      setFailure(
        apiErrorCode(err) === GrpcCode.FailedPrecondition
          ? t(pending.kind === 'funds' ? 'fundsUnavailable' : 'itemsUnavailable')
          : t('transferFailed'),
      );
      load();
      throw err;
    }
  };

  const confirmBody = pending
    ? pending.kind === 'funds'
      ? t('confirmFundsBody', { amount: formatGold(pending.amount), member: memberName, destination: destinationLabel })
      : t('confirmItemsBody', { count: pending.itemIds.length, member: memberName, destination: destinationLabel })
    : '';

  return (
    <>
      <Modal state={state}>
        <Modal.Backdrop>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={memberName} src={member?.avatar} className="shrink-0" />
                  <div className="flex min-w-0 flex-col items-start gap-0.5 type-body">
                    <Modal.Heading className="truncate">{t('title', { name: memberName })}</Modal.Heading>
                    {member && isGuildRole(member.role) && (
                      <Chip size="sm" color={roleChipColor(member.role)} variant="secondary">
                        {roleLabels(member.role)}
                      </Chip>
                    )}
                  </div>
                </div>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5">
                {member && (
                  <div className="flex flex-col gap-2">
                    <MemberRoleField member={member} onChanged={onRoleChanged} onStale={onMembersStale} />
                  </div>
                )}
                {status === 'loading' ? (
                  <div className="flex justify-center py-10">
                    <Spinner aria-label={t('loading')} />
                  </div>
                ) : status === 'error' || !assets ? (
                  <div role="alert" className="flex flex-col items-center gap-3 py-8">
                    <p className="type-body text-danger">{t('loadFailed')}</p>
                    <Button size="sm" variant="secondary" onPress={retry}>
                      {t('retry')}
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-surface-secondary p-3">
                        <p className="type-caption text-hint">{t('balance')}</p>
                        <p className="type-title tabular-nums text-foreground wrap-anywhere">{formatGold(assets.balance)}</p>
                      </div>
                      <div className="rounded-lg bg-surface-secondary p-3">
                        <p className="type-caption text-hint">{t('itemCount')}</p>
                        <p className="type-title tabular-nums text-foreground">{items.length}</p>
                      </div>
                    </div>

                    <section className="flex flex-col gap-3" aria-labelledby="member-assets-destination">
                      <p id="member-assets-destination" className="type-subheading text-foreground">
                        {t('destination')}
                      </p>
                      <ToggleButtonGroup
                        aria-label={t('destination')}
                        selectionMode="single"
                        disallowEmptySelection
                        selectedKeys={new Set([destinationKind])}
                        onSelectionChange={keys => {
                          const [next] = keys;
                          if (next) setDestinationKind(next as DestinationKind);
                        }}
                        size="sm"
                        className="self-start"
                      >
                        <ToggleButton id="member">
                          <Icon icon="solar:user-linear" width={16} aria-hidden />
                          {t('toMember')}
                        </ToggleButton>
                        <ToggleButton id="bank">
                          <ToggleButtonGroup.Separator />
                          <Icon icon="solar:safe-2-linear" width={16} aria-hidden />
                          {t('toGuildBank')}
                        </ToggleButton>
                      </ToggleButtonGroup>
                      {destinationKind === 'member' && (
                        <MemberComboBox
                          members={recipientOptions}
                          value={recipientId}
                          onChange={setRecipientId}
                          label={t('recipient')}
                          placeholder={t('searchRecipient')}
                          emptyMessage={t('noMembers')}
                          isInvalid={showRecipientError}
                          errorMessage={recipientError}
                        />
                      )}
                      <TextField validationBehavior="aria" isInvalid={Boolean(noteError)}>
                        <Label>{t('note')}</Label>
                        <TextArea
                          variant="secondary"
                          rows={2}
                          placeholder={t('notePlaceholder')}
                          value={note}
                          onChange={event => setNote(event.target.value)}
                        />
                        {noteError && <FieldError>{noteError}</FieldError>}
                      </TextField>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-3" aria-labelledby="member-assets-gold">
                      <p id="member-assets-gold" className="type-subheading text-foreground">
                        {t('goldSection')}
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <TextField
                          className="sm:flex-1"
                          validationBehavior="aria"
                          isInvalid={Boolean(amountError) && (showFundErrors || amount !== '')}
                        >
                          <Label>{t('amount')}</Label>
                          <Input
                            placeholder="0.00"
                            type="number"
                            min={0}
                            max={assets.balance}
                            step={GOLD_STEP}
                            inputMode="decimal"
                            variant="secondary"
                            value={amount}
                            onChange={event => setAmount(event.target.value)}
                          />
                          {amountError && (showFundErrors || amount !== '') && <FieldError>{amountError}</FieldError>}
                        </TextField>
                        <Button variant="primary" className="sm:mt-6" onPress={event => requestFunds(event.target)}>
                          <Icon icon="solar:wallet-money-linear" width={16} aria-hidden />
                          {t('transferGold')}
                        </Button>
                      </div>
                      <p className="type-caption text-hint">{t('available', { amount: formatGold(assets.balance) })}</p>
                    </section>

                    <Separator />

                    <section className="flex flex-col gap-3" aria-labelledby="member-assets-items">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p id="member-assets-items" className="type-subheading text-foreground">
                          {t('itemsSection', { count: items.length })}
                        </p>
                        <Button
                          size="sm"
                          variant="primary"
                          isDisabled={items.length === 0}
                          onPress={event => requestItems(event.target)}
                        >
                          <Icon icon="solar:arrow-right-linear" width={16} aria-hidden />
                          {t('transferItems', { count: selectedIds.length })}
                        </Button>
                      </div>
                      {items.length === 0 ? (
                        <EmptyContent icon="solar:backpack-linear" title={t('noItems')} />
                      ) : (
                        <>
                          <Checkbox
                            isSelected={allSelected}
                            isIndeterminate={selectedIds.length > 0 && !allSelected}
                            isDisabled={movableIds.length === 0}
                            onChange={toggleAll}
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              <Label className="type-caption text-subtle">{t('selectAll')}</Label>
                            </Checkbox.Content>
                          </Checkbox>
                          {showItemErrors && itemsError && (
                            <p role="alert" className="type-caption text-danger">
                              {itemsError}
                            </p>
                          )}
                          <ul className="flex flex-col gap-2" aria-label={t('itemList')}>
                            {items.map(item => {
                              const movable = isMovable(item);
                              return (
                                <li key={item.id} className="flex items-center gap-3 rounded-lg bg-surface-secondary px-3 py-2">
                                  <Checkbox
                                    aria-label={t('selectItem', { item: item.item.name })}
                                    isSelected={selected.has(item.id)}
                                    isDisabled={!movable}
                                    onChange={value => toggleOne(item.id, value)}
                                  >
                                    <Checkbox.Content>
                                      <Checkbox.Control>
                                        <Checkbox.Indicator />
                                      </Checkbox.Control>
                                    </Checkbox.Content>
                                  </Checkbox>
                                  <ItemThumbnail
                                    category={item.item.category}
                                    rarity={item.item.rarity}
                                    imageUrl={item.item.imageUrl}
                                  />
                                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="type-body font-medium text-foreground truncate">{item.item.name}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 type-caption text-hint">
                                      <span>
                                        {labels(`rarities.${item.item.rarity}`)} · {labels(`categories.${item.item.category}`)}
                                      </span>
                                      {item.lock && <ItemLockChip lock={item.lock} />}
                                      {item.deliveryRequestedAt && (
                                        <Chip size="sm" color="warning" variant="secondary">
                                          {t('awaitingDelivery')}
                                        </Chip>
                                      )}
                                    </div>
                                  </div>
                                  <Button
                                    isIconOnly
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t('history', { item: item.item.name })}
                                    onPress={() => {
                                      setHistoryItem(item);
                                      historyState.open();
                                    }}
                                  >
                                    <Icon icon="solar:history-linear" width={16} aria-hidden />
                                  </Button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </section>
                  </>
                )}
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  {t('close')}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <ConfirmDialog
        heading={t(pending?.kind === 'items' ? 'confirmItemsTitle' : 'confirmFundsTitle')}
        body={confirmBody}
        confirmLabel={t('confirm')}
        failedMessage={failure ?? t('transferFailed')}
        status="warning"
        isOpen={pending !== null}
        onOpenChange={open => {
          if (!open) setPending(null);
        }}
        onConfirm={confirmTransfer}
      />
      <ItemHistoryModal state={historyState} itemId={historyItem?.id ?? null} itemName={historyItem?.item.name ?? ''} />
    </>
  );
}
