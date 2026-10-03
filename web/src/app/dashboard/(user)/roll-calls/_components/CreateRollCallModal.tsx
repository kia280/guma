'use client';

import { Button, Description, Label, ListBox, Modal, Select } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemTemplatePicker } from '@/components/ItemTemplatePicker';
import { LootListEditor } from '@/components/LootListEditor';
import { RollCallFormFields } from '@/components/RollCallFormFields';
import type { RollCallDraftController } from '../_hooks/useRollCallDraft';
import type { RollCallTemplates } from '../_hooks/useRollCallTemplates';

type CreateRollCallModalProps = {
  creation: RollCallDraftController;
  templates: RollCallTemplates;
};

export function CreateRollCallModal({ creation, templates }: CreateRollCallModalProps) {
  const t = useTranslations('rollCall');
  const { draft } = creation;
  const templatesState = templates.state;

  return (
    <Modal state={creation.modalState}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-center gap-2 pr-8">
              <Icon icon="solar:add-circle-linear" width={18} className="shrink-0" />
              <Modal.Heading>{t('addRollCall')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <RollCallFormFields
                values={draft}
                errors={creation.errors}
                showErrors={creation.showErrors}
                onChange={creation.updateDraft}
                onDatetimeChange={creation.changeDatetime}
                header={templatesState !== 'hidden' && (
                  <div className="flex flex-col gap-1">
                    <Select
                      placeholder={
                        templatesState === 'loading'
                          ? t('templatesLoading')
                          : templatesState === 'ready' && templates.templates.length === 0
                            ? t('noTemplates')
                            : t('templatePlaceholder')
                      }
                      value={creation.selectedTemplateId}
                      onChange={creation.changeTemplate}
                      isDisabled={templatesState !== 'ready' || templates.templates.length === 0}
                    >
                      <Label>{t('template')}</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {templates.templates.map(template => (
                            <ListBox.Item key={template.id} id={template.id} textValue={template.name}>
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate">{template.name}</span>
                                <span className="type-caption text-hint truncate">
                                  {t('templateSummary', { title: template.title, count: template.items.length })}
                                </span>
                              </div>
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                      <Description className={templatesState === 'failed' ? 'text-danger' : undefined}>
                        {templatesState === 'failed' ? t('templatesLoadFailed') : t('templateHint')}
                      </Description>
                    </Select>
                    {templatesState === 'failed' && (
                      <Button size="sm" variant="tertiary" className="self-start" onPress={templates.retry}>
                        {t('templatesRetry')}
                      </Button>
                    )}
                  </div>
                )}
                loot={
                  <>
                    <LootListEditor
                      items={draft.lootList}
                      inputValue={draft.lootInput}
                      onChange={(lootList, lootInput) => creation.updateDraft({ lootList, lootInput })}
                    >
                      {templatesState !== 'hidden' && (
                        <ItemTemplatePicker
                          templates={templates.itemTemplates}
                          onPick={creation.pickItemTemplate}
                          isDisabled={templatesState !== 'ready'}
                          placeholder={
                            templatesState === 'loading'
                              ? t('templatesLoading')
                              : templates.itemTemplates.length === 0
                                ? t('noItemTemplates')
                                : t('itemTemplatePlaceholder')
                          }
                          description={t('itemTemplateHint')}
                        />
                      )}
                    </LootListEditor>
                    {draft.lootList.length > 0 && (
                      <p className="type-caption text-hint -mt-2">{t('lootToBankHint')}</p>
                    )}
                    {draft.lootList.some(entry => entry.kind === 'gold') && (
                      <p className="type-caption text-hint -mt-2">{t('goldToVaultHint')}</p>
                    )}
                  </>
                }
                footer={<p className="type-caption text-hint px-1">{t('draftSaved')}</p>}
              />
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary" onPress={creation.cancel}>
                {t('cancel')}
              </Button>
              <Button variant="primary" onPress={e => creation.submit(e.target)} isPending={creation.isCreating}>
                {t('create')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
