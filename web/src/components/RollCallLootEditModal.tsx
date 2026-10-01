'use client';

import { Button, Chip, FieldError, Input, Modal, Spinner, TextField, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemTemplatePicker } from '@/components/ItemTemplatePicker';
import { getCategoryIcon } from '@/components/ItemThumbnail';
import { LOOT_NAME_MAX_LENGTH, LootListEditor } from '@/components/LootListEditor';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import type { GuildBankItem } from '@/types/guild-bank';
import { ItemCategory } from '@/types/item';
import type { RollCall, ItemTemplate, LootEntry, LootItem } from '@/types/roll-call';
import { ItemLockChip } from './ItemLockChip';

type LoadStatus = 'loading' | 'ready' | 'error';
type TemplatesStatus = LoadStatus | 'hidden';
type SaveError = 'conflict' | 'forbidden' | 'invalid' | 'failed';

type ExistingRow = { loot: LootItem; name: string };

const toSaveError = (err: unknown): SaveError => {
  switch (apiErrorCode(err)) {
    case GrpcCode.FailedPrecondition:
      return 'conflict';
    case GrpcCode.PermissionDenied:
      return 'forbidden';
    case GrpcCode.InvalidArgument:
      return 'invalid';
    default:
      return 'failed';
  }
};

const toLootEntry = (item: ItemTemplate): LootEntry => ({
  name: item.name,
  description: item.description || undefined,
  category: item.category,
  rarity: item.rarity,
});

export function RollCallLootEditModal({
  entry,
  state,
  onSaved,
  onConflict,
}: {
  entry: RollCall;
  state: UseOverlayStateReturn;
  onSaved: (updated: RollCall) => void;
  onConflict: () => void;
}) {
  const t = useTranslations('rollCallLootEdit');
  const loot = useTranslations('rollCallLoot');
  const rollCall = useTranslations('rollCall');
  const guildId = useCurrentGuildId();
  const notify = useToast();

  const [bankItems, setBankItems] = React.useState<GuildBankItem[]>([]);
  const [bankStatus, setBankStatus] = React.useState<LoadStatus>('loading');
  const [itemTemplates, setItemTemplates] = React.useState<ItemTemplate[]>([]);
  const [templatesStatus, setTemplatesStatus] = React.useState<TemplatesStatus>('loading');
  const [existing, setExisting] = React.useState<ExistingRow[]>([]);
  const [newItems, setNewItems] = React.useState<LootEntry[]>([]);
  const [lootInput, setLootInput] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<SaveError | null>(null);

  const loadBank = React.useCallback(() => {
    setBankStatus('loading');
    apiClient
      .listBankItems(guildId, { rollCallId: entry.id })
      .then(items => {
        setBankItems(items);
        setBankStatus('ready');
      })
      .catch(() => setBankStatus('error'));
  }, [guildId, entry.id]);

  const loadTemplates = React.useCallback(() => {
    setTemplatesStatus('loading');
    apiClient
      .listItemTemplates(guildId)
      .then(items => {
        setItemTemplates(items);
        setTemplatesStatus('ready');
      })
      .catch(err => setTemplatesStatus(apiErrorCode(err) === GrpcCode.PermissionDenied ? 'hidden' : 'error'));
  }, [guildId]);

  const wasOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (state.isOpen && !wasOpenRef.current) {
      setExisting(entry.lootList.map(item => ({ loot: item, name: item.name })));
      setNewItems([]);
      setLootInput('');
      setShowErrors(false);
      setSaveError(null);
      loadBank();
      loadTemplates();
    }
    wasOpenRef.current = state.isOpen;
  }, [state.isOpen, entry.lootList, loadBank, loadTemplates]);

  const inVault = new Map(bankItems.map(item => [item.id, item]));
  const isEditable = (item: LootItem) => {
    const bankItem = inVault.get(item.id);
    return !!bankItem && !bankItem.lock;
  };
  const removedCount = entry.lootList.filter(
    item => !existing.some(row => row.loot.id === item.id),
  ).length;
  const hasBlankName = existing.some(row => isEditable(row.loot) && !row.name.trim());

  const renameRow = (id: string, name: string) => {
    setExisting(rows => rows.map(row => (row.loot.id === id ? { ...row, name } : row)));
    setSaveError(null);
  };

  const removeRow = (id: string) => {
    setExisting(rows => rows.filter(row => row.loot.id !== id));
    setSaveError(null);
  };

  const handleSave = async (trigger: Element) => {
    if (hasBlankName) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    const pendingName = lootInput.trim();
    const additions = pendingName ? [...newItems, { name: pendingName }] : newItems;
    const lootList: LootEntry[] = [
      ...existing.map(({ loot: item, name }) => ({
        id: item.id,
        name: isEditable(item) ? name.trim() : item.name,
        description: item.description,
        category: item.category,
        rarity: item.rarity,
      })),
      ...additions,
    ];
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await apiClient.updateRollCallLoot(guildId, entry.id, lootList);
      onSaved(updated);
      notify.success(t('saveSuccess'));
      state.close();
    } catch (err) {
      const error = toSaveError(err);
      setSaveError(error);
      if (error === 'conflict') {
        loadBank();
        onConflict();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveErrorMessage: Record<SaveError, string> = {
    conflict: t('saveConflict'),
    forbidden: t('saveForbidden'),
    invalid: t('saveInvalid'),
    failed: t('saveFailed'),
  };

  const frozenStatus = (item: LootItem) => {
    const bankItem = inVault.get(item.id);
    if (bankItem?.lock) return <ItemLockChip lock={bankItem.lock} />;
    return (
      <Chip size="sm" variant="secondary" color="success">
        {loot('distributed')}
      </Chip>
    );
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop isDismissable={!isSaving}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-center gap-2 pr-8">
              <Icon icon="solar:box-linear" width={18} className="shrink-0" />
              <Modal.Heading>{t('title')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {bankStatus === 'loading' && (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" aria-label={loot('loading')} />
                </div>
              )}
              {bankStatus === 'error' && (
                <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-divider p-3">
                  <p className="type-caption text-danger">{loot('loadFailed')}</p>
                  <Button size="sm" variant="secondary" onPress={loadBank}>
                    {loot('retry')}
                  </Button>
                </div>
              )}
              {bankStatus === 'ready' && (
                <>
                  <div className="flex flex-col gap-2">
                    <p className="type-body font-medium text-foreground">{t('currentLoot')}</p>
                    {existing.length === 0 ? (
                      <p className="type-body text-subtle">{t('noCurrentLoot')}</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {existing.map(({ loot: item, name }) => {
                          const bankItem = inVault.get(item.id);
                          const editable = isEditable(item);
                          const isInvalid = showErrors && editable && !name.trim();
                          return (
                            <li
                              key={item.id}
                              className="flex items-start gap-2 rounded-lg border border-divider bg-surface-secondary px-3 py-2 type-body"
                            >
                              <Icon
                                icon={editable ? getCategoryIcon(item.category ?? ItemCategory.MISC) : 'solar:lock-keyhole-linear'}
                                width={16}
                                className="mt-2.5 shrink-0 text-hint"
                              />
                              {editable ? (
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                  <TextField
                                    aria-label={t('nameFor', { item: item.name })}
                                    validationBehavior="aria"
                                    isInvalid={isInvalid}
                                    className="w-full"
                                  >
                                    <Input
                                      value={name}
                                      onChange={e => renameRow(item.id, e.target.value)}
                                      maxLength={LOOT_NAME_MAX_LENGTH}
                                      variant="primary"
                                    />
                                    {isInvalid && <FieldError>{t('nameRequired')}</FieldError>}
                                  </TextField>
                                  {bankItem && bankItem.pendingRequestCount > 0 && (
                                    <p className="type-caption text-warning">
                                      {t('pendingRequests', { count: bankItem.pendingRequestCount })}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
                                  <span className="truncate text-foreground">{item.name}</span>
                                  {frozenStatus(item)}
                                </div>
                              )}
                              {editable && (
                                <Button
                                  size="sm"
                                  isIconOnly
                                  variant="tertiary"
                                  aria-label={rollCall('removeLootItem', { name: item.name })}
                                  className="mt-0.5 shrink-0 text-hint hover:text-danger max-sm:size-11"
                                  onPress={() => removeRow(item.id)}
                                >
                                  <Icon icon="solar:trash-bin-minimalistic-linear" width={16} />
                                </Button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="type-caption text-hint flex items-start gap-1.5">
                      <Icon icon="solar:lock-keyhole-linear" width={12} className="mt-1 shrink-0" />
                      <span>{t('frozenHint')}</span>
                    </p>
                    {removedCount > 0 && (
                      <p className="type-caption text-warning">{t('removeHint', { count: removedCount })}</p>
                    )}
                  </div>
                  <LootListEditor
                    label={t('addLoot')}
                    allowGold={false}
                    items={newItems}
                    inputValue={lootInput}
                    onChange={(items, inputValue) => {
                      setNewItems(items);
                      setLootInput(inputValue);
                      setSaveError(null);
                    }}
                  >
                    {templatesStatus !== 'hidden' && (
                      <ItemTemplatePicker
                        templates={itemTemplates}
                        onPick={item => setNewItems(items => [...items, toLootEntry(item)])}
                        isDisabled={templatesStatus !== 'ready'}
                        placeholder={
                          templatesStatus === 'loading'
                            ? rollCall('templatesLoading')
                            : templatesStatus === 'error'
                              ? rollCall('templatesLoadFailed')
                              : itemTemplates.length === 0
                                ? rollCall('noItemTemplates')
                                : rollCall('itemTemplatePlaceholder')
                        }
                        description={rollCall('itemTemplateHint')}
                      />
                    )}
                  </LootListEditor>
                  {(newItems.length > 0 || lootInput.trim()) && (
                    <p className="type-caption text-hint -mt-2">{t('addHint')}</p>
                  )}
                </>
              )}
              {saveError && (
                <p role="alert" className="type-caption text-danger">
                  {saveErrorMessage[saveError]}
                </p>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" isDisabled={isSaving}>
                {rollCall('cancel')}
              </Button>
              <Button
                variant="primary"
                onPress={e => handleSave(e.target)}
                isPending={isSaving}
                isDisabled={bankStatus !== 'ready'}
              >
                {rollCall('save')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
