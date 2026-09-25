'use client';

import React from 'react';
import { Button, Card, Chip, Input, Label, Modal, TextField, useOverlayState } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { ItemTemplatePicker } from '@/components/ItemTemplatePicker';
import { getCategoryIcon, getRarityColor } from '@/components/ItemThumbnail';
import {
  DeleteTemplateDialog,
  ErrorAlert,
  TemplateListState,
  templateErrorKey,
  useTemplateList,
} from '@/components/TemplateManagerParts';
import { apiClient } from '@/lib/guma';
import type { CheckinTemplate, ItemTemplate } from '@/types/checkin';

const NAME_MAX_LENGTH = 100;
const TITLE_MAX_LENGTH = 200;

interface TemplateDraft {
  name: string;
  title: string;
  items: ItemTemplate[];
}

const emptyDraft: TemplateDraft = { name: '', title: '', items: [] };

export function CheckinTemplateManager({ guildId }: { guildId: string }) {
  const t = useTranslations('checkinTemplates');
  const shared = useTranslations('templates');
  const labels = useTranslations('createAuctionModal');
  const formModal = useOverlayState();

  const loadTemplates = React.useCallback(() => apiClient.listCheckinTemplates(guildId), [guildId]);
  const { items: templates, isLoading, loadFailed, reload, upsert, remove } = useTemplateList(loadTemplates);
  const loadItems = React.useCallback(() => apiClient.listItemTemplates(guildId), [guildId]);
  const itemLibrary = useTemplateList(loadItems);

  const [editing, setEditing] = React.useState<CheckinTemplate | null>(null);
  const [draft, setDraft] = React.useState<TemplateDraft>(emptyDraft);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CheckinTemplate | null>(null);

  const openForm = (template: CheckinTemplate | null) => {
    setEditing(template);
    setDraft(template ? { name: template.name, title: template.title, items: template.items } : emptyDraft);
    setSaveError(null);
    itemLibrary.reload();
    formModal.open();
  };

  const canSave = draft.name.trim() !== '' && draft.title.trim() !== '';

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    const input = {
      name: draft.name.trim(),
      title: draft.title.trim(),
      itemTemplateIds: draft.items.map(item => item.id),
    };
    try {
      upsert(
        editing
          ? await apiClient.updateCheckinTemplate(guildId, editing.id, input)
          : await apiClient.createCheckinTemplate(guildId, input),
      );
      formModal.close();
    } catch (err) {
      setSaveError(shared(templateErrorKey(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const itemPickerPlaceholder = itemLibrary.isLoading
    ? t('itemsLoading')
    : itemLibrary.loadFailed
      ? t('itemsLoadFailed')
      : itemLibrary.items.length === 0
        ? t('noItemTemplates')
        : t('itemPlaceholder');

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
        emptyIcon="solar:clipboard-list-linear"
        emptyTitle={t('emptyTitle')}
        emptyHint={t('emptyHint')}
      >
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map(template => (
            <li key={template.id}>
              <Card className="h-full border border-divider shadow-none bg-surface">
                <Card.Header className="flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="type-subheading text-foreground truncate">{template.name}</h3>
                    <p className="type-body text-subtle truncate">{template.title}</p>
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
                </Card.Header>
                <Card.Content className="pt-0">
                  {template.items.length === 0 ? (
                    <p className="type-caption text-hint">{t('noItems')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="type-caption text-hint">{t('itemCount', { count: template.items.length })}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {template.items.map((item, idx) => (
                          <Chip key={`${idx}-${item.id}`} size="sm" variant="secondary" color={getRarityColor(item.rarity)}>
                            {item.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </Card.Content>
              </Card>
            </li>
          ))}
        </ul>
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
                  <TextField isRequired maxLength={TITLE_MAX_LENGTH}>
                    <Label>{t('checkinTitle')}</Label>
                    <Input
                      placeholder={t('checkinTitlePlaceholder')}
                      value={draft.title}
                      onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                      variant="secondary"
                    />
                  </TextField>
                  <div className="flex flex-col gap-2">
                    <ItemTemplatePicker
                      templates={itemLibrary.items}
                      placeholder={itemPickerPlaceholder}
                      isDisabled={itemLibrary.isLoading || itemLibrary.loadFailed}
                      description={itemLibrary.items.length === 0 && !itemLibrary.isLoading ? t('noItemTemplatesHint') : undefined}
                      onPick={item => setDraft(d => ({ ...d, items: [...d.items, item] }))}
                    />
                    {itemLibrary.loadFailed && (
                      <Button size="sm" variant="tertiary" className="self-start" onPress={itemLibrary.reload}>
                        {shared('retry')}
                      </Button>
                    )}
                    {draft.items.length > 0 && (
                      <ul aria-label={t('items')} className="flex flex-col gap-1">
                        {draft.items.map((item, idx) => (
                          <li
                            key={`${idx}-${item.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-surface-secondary border border-divider"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Icon icon={getCategoryIcon(item.category)} width={14} className="shrink-0 text-hint" />
                              <span className="type-body text-foreground truncate">{item.name}</span>
                              <Chip size="sm" variant="secondary" color={getRarityColor(item.rarity)} className="shrink-0">
                                {labels(`rarities.${item.rarity}`)}
                              </Chip>
                            </div>
                            <Button
                              size="sm"
                              isIconOnly
                              variant="tertiary"
                              aria-label={t('removeItem', { name: item.name })}
                              className="shrink-0 text-hint hover:text-danger"
                              onPress={() => setDraft(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }))}
                            >
                              <Icon icon="solar:close-circle-linear" width={14} />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
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
        onDelete={id => apiClient.deleteCheckinTemplate(guildId, id)}
        onDeleted={remove}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
