'use client';

import React from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { ItemThumbnail, getRarityColor } from '@/components/ItemThumbnail';
import {
  DeleteTemplateDialog,
  ErrorAlert,
  TemplateListState,
  templateErrorKey,
  useTemplateList,
} from '@/components/TemplateManagerParts';
import { apiClient } from '@/lib/guma';
import type { ItemTemplate, ItemTemplateInput } from '@/types/checkin';
import { ItemCategory, ItemRarity } from '@/types/item';

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

const emptyDraft: ItemTemplateInput = {
  name: '',
  description: '',
  category: ItemCategory.MATERIAL,
  rarity: ItemRarity.COMMON,
};

export function ItemTemplateManager({ guildId }: { guildId: string }) {
  const t = useTranslations('itemTemplates');
  const shared = useTranslations('templates');
  const labels = useTranslations('createAuctionModal');
  const formModal = useOverlayState();

  const load = React.useCallback(() => apiClient.listItemTemplates(guildId), [guildId]);
  const { items: templates, isLoading, loadFailed, reload, upsert, remove } = useTemplateList(load);

  const [editing, setEditing] = React.useState<ItemTemplate | null>(null);
  const [draft, setDraft] = React.useState<ItemTemplateInput>(emptyDraft);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ItemTemplate | null>(null);

  const openForm = (template: ItemTemplate | null) => {
    setEditing(template);
    setDraft(template ? { name: template.name, description: template.description, category: template.category, rarity: template.rarity } : emptyDraft);
    setSaveError(null);
    formModal.open();
  };

  const canSave = draft.name.trim() !== '';

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const input = { ...draft, name: draft.name.trim(), description: draft.description.trim() };
    try {
      upsert(
        editing
          ? await apiClient.updateItemTemplate(guildId, editing.id, input)
          : await apiClient.createItemTemplate(guildId, input),
      );
      formModal.close();
    } catch (err) {
      setSaveError(shared(templateErrorKey(err)));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="type-body text-subtle">{t('description')}</p>
        <Button size="sm" variant="primary" className="shrink-0" onPress={() => openForm(null)}>
          <Icon icon="solar:add-circle-linear" width={16} />
          {t('create')}
        </Button>
      </div>

      <TemplateListState
        isLoading={isLoading}
        loadFailed={loadFailed}
        isEmpty={templates.length === 0}
        onRetry={reload}
        emptyIcon="solar:box-linear"
        emptyTitle={t('emptyTitle')}
        emptyHint={t('emptyHint')}
      >
        <Card className="border border-divider shadow-none bg-surface">
          <Card.Content className="p-1.5">
            <ul className="flex flex-col gap-0.5">
              {templates.map(template => (
                <li key={template.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                  <ItemThumbnail category={template.category} rarity={template.rarity} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="type-body font-medium text-foreground truncate">{template.name}</p>
                      <Chip size="sm" variant="secondary" color={getRarityColor(template.rarity)} className="shrink-0">
                        {labels(`rarities.${template.rarity}`)}
                      </Chip>
                    </div>
                    <p className="type-caption text-hint truncate">
                      {labels(`categories.${template.category}`)}
                      {template.description ? ` · ${template.description}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="tertiary"
                      isIconOnly
                      aria-label={shared('editNamed', { name: template.name })}
                      onPress={() => openForm(template)}
                    >
                      <Icon icon="solar:pen-linear" width={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      isIconOnly
                      aria-label={shared('deleteNamed', { name: template.name })}
                      className="text-hint hover:text-danger"
                      onPress={() => setDeleteTarget(template)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={16} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card.Content>
        </Card>
      </TemplateListState>

      <Modal state={formModal}>
        <Modal.Backdrop>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <form
                className="contents"
                onSubmit={event => {
                  event.preventDefault();
                  handleSave();
                }}
              >
                <Modal.Header className="text-center items-center">
                  <Modal.Heading>{editing ? t('editTitle') : t('createTitle')}</Modal.Heading>
                </Modal.Header>
                <Modal.Body className="p-1 flex flex-col gap-4">
                  <TextField isRequired maxLength={NAME_MAX_LENGTH}>
                    <Label>{t('name')}</Label>
                    <Input
                      placeholder={t('namePlaceholder')}
                      value={draft.name}
                      onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                      variant="secondary"
                      autoFocus
                    />
                  </TextField>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                      isRequired
                      value={draft.category}
                      onChange={value => setDraft(d => ({ ...d, category: value as ItemCategory }))}
                    >
                      <Label>{t('category')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {Object.values(ItemCategory).map(category => (
                            <ListBox.Item key={category} id={category} textValue={labels(`categories.${category}`)}>
                              {labels(`categories.${category}`)}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Select
                      isRequired
                      value={draft.rarity}
                      onChange={value => setDraft(d => ({ ...d, rarity: value as ItemRarity }))}
                    >
                      <Label>{t('rarity')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {Object.values(ItemRarity).map(rarity => (
                            <ListBox.Item key={rarity} id={rarity} textValue={labels(`rarities.${rarity}`)}>
                              {labels(`rarities.${rarity}`)}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <TextField maxLength={DESCRIPTION_MAX_LENGTH}>
                    <Label>{t('itemDescription')}</Label>
                    <TextArea
                      placeholder={t('itemDescriptionPlaceholder')}
                      value={draft.description}
                      onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                      variant="secondary"
                      rows={2}
                    />
                  </TextField>
                  <ErrorAlert message={saveError} />
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary" isDisabled={isSaving}>
                    {shared('cancel')}
                  </Button>
                  <Button type="submit" variant="primary" isPending={isSaving} isDisabled={!canSave}>
                    {shared('save')}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <DeleteTemplateDialog
        target={deleteTarget}
        description={t('deleteConfirm', { name: deleteTarget?.name ?? '' })}
        onDelete={id => apiClient.deleteItemTemplate(guildId, id)}
        onDeleted={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
