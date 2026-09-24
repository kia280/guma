'use client';

import React from 'react';
import {
  Alert,
  AlertDialog,
  Button,
  Card,
  Chip,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

import { LootListEditor } from '@/components/LootListEditor';
import { apiClient } from '@/lib/guma';
import { GrpcCode, apiErrorCode } from '@/lib/guma/errors';
import type { CheckinTemplate } from '@/types/checkin';

const NAME_MAX_LENGTH = 100;
const TITLE_MAX_LENGTH = 200;

interface TemplateDraft {
  name: string;
  title: string;
  lootInput: string;
  lootList: string[];
}

const emptyDraft: TemplateDraft = { name: '', title: '', lootInput: '', lootList: [] };

const saveErrorKey = (err: unknown) => {
  switch (apiErrorCode(err)) {
    case GrpcCode.AlreadyExists:
      return 'errorNameTaken';
    case GrpcCode.PermissionDenied:
      return 'errorForbidden';
    case GrpcCode.NotFound:
      return 'errorNotFound';
    case GrpcCode.InvalidArgument:
      return 'errorInvalid';
    default:
      return 'errorGeneric';
  }
};

export function CheckinTemplateManager({ guildId }: { guildId: string }) {
  const t = useTranslations('checkinTemplates');
  const formModal = useOverlayState();

  const [templates, setTemplates] = React.useState<CheckinTemplate[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const [editing, setEditing] = React.useState<CheckinTemplate | null>(null);
  const [draft, setDraft] = React.useState<TemplateDraft>(emptyDraft);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = React.useState<CheckinTemplate | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const latestLoad = React.useRef(0);

  const load = React.useCallback(async () => {
    const loadId = ++latestLoad.current;
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const list = await apiClient.listCheckinTemplates(guildId);
      if (loadId === latestLoad.current) setTemplates(list);
    } catch {
      if (loadId === latestLoad.current) setLoadFailed(true);
    } finally {
      if (loadId === latestLoad.current) setIsLoading(false);
    }
  }, [guildId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const openForm = (template: CheckinTemplate | null) => {
    setEditing(template);
    setDraft(
      template
        ? { name: template.name, title: template.title, lootInput: '', lootList: template.lootList.map(i => i.name) }
        : emptyDraft,
    );
    setSaveError(null);
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
      lootList: draft.lootList.map(name => ({ name })),
    };
    try {
      const saved = editing
        ? await apiClient.updateCheckinTemplate(guildId, editing.id, input)
        : await apiClient.createCheckinTemplate(guildId, input);
      setTemplates(prev =>
        (editing ? prev.map(tpl => (tpl.id === saved.id ? saved : tpl)) : [...prev, saved]).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      formModal.close();
    } catch (err) {
      setSaveError(t(saveErrorKey(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const openDelete = (template: CheckinTemplate) => {
    setDeleteTarget(template);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.deleteCheckinTemplate(guildId, deleteTarget.id);
      setTemplates(prev => prev.filter(tpl => tpl.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === GrpcCode.NotFound) {
        setTemplates(prev => prev.filter(tpl => tpl.id !== deleteTarget.id));
        setDeleteTarget(null);
        return;
      }
      setDeleteError(t(code === GrpcCode.PermissionDenied ? 'errorForbidden' : 'errorGeneric'));
    } finally {
      setIsDeleting(false);
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

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner aria-label={t('loading')} />
        </div>
      ) : loadFailed ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('loadFailed')}</Alert.Title>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={load}>
            {t('retry')}
          </Button>
        </Alert>
      ) : templates.length === 0 ? (
        <Card className="border border-divider shadow-none bg-surface">
          <Card.Content className="text-center py-12">
            <Icon icon="solar:clipboard-list-linear" width={40} className="mx-auto mb-3 text-disabled" />
            <h3 className="type-subheading mb-1 text-foreground">{t('emptyTitle')}</h3>
            <p className="type-body text-subtle">{t('emptyHint')}</p>
          </Card.Content>
        </Card>
      ) : (
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
                      aria-label={t('editNamed', { name: template.name })}
                      onPress={() => openForm(template)}
                    >
                      <Icon icon="solar:pen-linear" width={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="tertiary"
                      isIconOnly
                      aria-label={t('deleteNamed', { name: template.name })}
                      className="text-hint hover:text-danger"
                      onPress={() => openDelete(template)}
                    >
                      <Icon icon="solar:trash-bin-trash-linear" width={16} />
                    </Button>
                  </div>
                </Card.Header>
                <Card.Content className="pt-0">
                  {template.lootList.length === 0 ? (
                    <p className="type-caption text-hint">{t('noLoot')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="type-caption text-hint">{t('lootCount', { count: template.lootList.length })}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {template.lootList.map(item => (
                          <Chip key={item.id} size="sm" variant="secondary">
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
      )}

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
                  <LootListEditor
                    items={draft.lootList}
                    inputValue={draft.lootInput}
                    onChange={(lootList, lootInput) => setDraft(d => ({ ...d, lootList, lootInput }))}
                  />
                  {saveError && (
                    <Alert status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>{saveError}</Alert.Title>
                      </Alert.Content>
                    </Alert>
                  )}
                </Modal.Body>
                <Modal.Footer>
                  <Button slot="close" variant="secondary" isDisabled={isSaving}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" variant="primary" isPending={isSaving} isDisabled={!canSave}>
                    {t('save')}
                  </Button>
                </Modal.Footer>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <AlertDialog.Backdrop
        isOpen={deleteTarget !== null}
        onOpenChange={isOpen => {
          if (!isOpen && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{t('deleteTitle')}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="flex flex-col gap-3">
              <p className="type-body text-subtle">{t('deleteConfirm', { name: deleteTarget?.name ?? '' })}</p>
              {deleteError && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{deleteError}</Alert.Title>
                  </Alert.Content>
                </Alert>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary" isDisabled={isDeleting}>
                {t('cancel')}
              </Button>
              <Button variant="danger" isPending={isDeleting} onPress={handleDelete}>
                {t('delete')}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
}
