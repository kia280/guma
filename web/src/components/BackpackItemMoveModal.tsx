'use client';

import {
  Autocomplete,
  Button,
  Description,
  EmptyState,
  FieldError,
  Label,
  ListBox,
  Modal,
  SearchField,
  TextArea,
  TextField,
  useFilter,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { focusFirstInvalidField } from '@/lib/focus-invalid-field';
import { apiClient } from '@/lib/guma';
import { useUserStore } from '@/lib/store';
import type { BackpackItem } from '@/types/backpack';
import type { MockUser } from '@/types/user';
import { ItemThumbnail } from './ItemThumbnail';

export type BackpackMoveMode = 'donate' | 'transfer';

type BackpackItemMoveModalProps = {
  state: UseOverlayStateReturn;
  mode: BackpackMoveMode;
  item: BackpackItem | null;
  members: MockUser[];
  onMoved: () => void;
};

const NOTE_MAX_LENGTH = 200;

export function BackpackItemMoveModal({ state, mode, item, members, onMoved }: BackpackItemMoveModalProps) {
  const t = useTranslations('backpackItemMoveModal');
  const labels = useTranslations('createAuctionModal');
  const notify = useToast();
  const guildId = useCurrentGuildId();
  const currentUserId = useUserStore(s => s.user?.id);
  const { contains } = useFilter({ sensitivity: 'base' });
  const [recipient, setRecipient] = React.useState('');
  const [note, setNote] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const openKey = state.isOpen && item ? `${mode}:${item.id}` : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    setRecipient('');
    setNote('');
    setShowErrors(false);
  }

  const recipients = members.filter(member => member.id !== currentUserId);
  const recipientError = mode === 'transfer' && !recipient ? t('recipientRequired') : null;
  const noteError = note.length > NOTE_MAX_LENGTH ? t('noteTooLong', { max: NOTE_MAX_LENGTH }) : null;

  const submit = async (trigger: Element) => {
    if (!item) return;
    if (recipientError || noteError) {
      setShowErrors(true);
      focusFirstInvalidField(trigger);
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === 'donate') {
        await apiClient.donateItem(guildId, item.id, note.trim() || undefined);
      } else {
        await apiClient.transferBackpackItem(guildId, item.id, { recipientId: recipient, note: note.trim() || undefined });
      }
      notify.success(t(`${mode}Success`, { item: item.item.name }));
      onMoved();
      state.close();
    } catch {
      notify.error(t(`${mode}Failed`));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t(`${mode}Title`)}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              {item && (
                <div className="flex items-center gap-3 rounded-lg bg-surface-secondary p-3">
                  <ItemThumbnail category={item.item.category} rarity={item.item.rarity} imageUrl={item.item.imageUrl} />
                  <div className="min-w-0">
                    <p className="type-body font-medium text-foreground truncate">{item.item.name}</p>
                    <p className="type-caption text-hint">
                      {labels(`rarities.${item.item.rarity}`)} · {labels(`categories.${item.item.category}`)}
                    </p>
                  </div>
                </div>
              )}
              <p className="type-body text-soft">{t(`${mode}Description`)}</p>
              {mode === 'transfer' && (
                <Autocomplete
                  className="w-full"
                  placeholder={t('searchRecipient')}
                  selectionMode="single"
                  validationBehavior="aria"
                  isInvalid={showErrors && Boolean(recipientError)}
                  value={recipient}
                  onChange={key => setRecipient((key as string) ?? '')}
                >
                  <Label>{t('recipient')}</Label>
                  <Autocomplete.Trigger>
                    <Autocomplete.Value />
                    <Autocomplete.Indicator />
                  </Autocomplete.Trigger>
                  <Autocomplete.Popover>
                    <Autocomplete.Filter filter={contains}>
                      <SearchField autoFocus name="search" variant="secondary">
                        <SearchField.Group>
                          <SearchField.SearchIcon />
                          <SearchField.Input placeholder={t('searchRecipient')} />
                          <SearchField.ClearButton />
                        </SearchField.Group>
                      </SearchField>
                      <ListBox renderEmptyState={() => <EmptyState>{t('noMembers')}</EmptyState>}>
                        {recipients.map(member => (
                          <ListBox.Item key={member.id} id={member.id} textValue={member.username}>
                            <div className="flex flex-col">
                              <Label>{member.username}</Label>
                              {member.email && <Description>{member.email}</Description>}
                            </div>
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Autocomplete.Filter>
                  </Autocomplete.Popover>
                  {showErrors && recipientError && <FieldError>{recipientError}</FieldError>}
                </Autocomplete>
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
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button variant="primary" isPending={isSubmitting} onPress={event => submit(event.target)}>
                <Icon icon={mode === 'donate' ? 'solar:safe-2-linear' : 'solar:arrow-right-linear'} width={16} />
                {t(`${mode}Confirm`)}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
