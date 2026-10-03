'use client';

import { Button, Label, Modal, TextArea, TextField, type UseOverlayStateReturn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { getCategoryIcon } from '@/components/ItemThumbnail';
import { useToast } from '@/hooks/useToast';
import { apiClient } from '@/lib/guma';
import type { GuildBankItem } from '@/types/guild-bank';
import { useRequestErrorMessage } from '../_hooks/useRequestErrorMessage';
import { REASON_MAX_LENGTH } from '../_lib/contributions';
import { InfoNote } from './InfoNote';
import { RequestErrorAlert } from './RequestErrorAlert';

type ItemRequestModalProps = {
  state: UseOverlayStateReturn;
  guildId: string;
  item: GuildBankItem | null;
  onRequested: () => void;
};

export function ItemRequestModal({ state, guildId, item, onRequested }: ItemRequestModalProps) {
  const t = useTranslations('guildBankPage');
  const labels = useTranslations('createAuctionModal');
  const notify = useToast();
  const requestErrorMessage = useRequestErrorMessage();
  const [reason, setReason] = React.useState('');
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);

  const [wasOpen, setWasOpen] = React.useState(state.isOpen);
  if (wasOpen !== state.isOpen) {
    setWasOpen(state.isOpen);
    if (state.isOpen) setRequestError(null);
  }

  const handleRequest = async () => {
    if (!item || !reason.trim()) return;
    setIsRequesting(true);
    setRequestError(null);
    try {
      await apiClient.requestItem(guildId, item.id, reason.trim());
      onRequested();
      notify.success(t('requestSuccess'));
      setReason('');
      state.close();
    } catch (err) {
      setRequestError(requestErrorMessage(err));
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('requestItemTitle')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              {item && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary">
                    <div className="p-2 rounded-lg bg-default">
                      <Icon icon={getCategoryIcon(item.category)} width={20} className="text-subtle" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="type-body font-medium text-foreground">{item.name}</p>
                      <p className="type-caption text-hint">
                        {t('itemSummary', {
                          rarity: labels(`rarities.${item.rarity}`),
                          category: labels(`categories.${item.category}`),
                          count: item.quantity,
                        })}
                      </p>
                    </div>
                  </div>
                  <TextField>
                    <Label>{t('reason')}</Label>
                    <TextArea
                      autoFocus
                      placeholder={t('itemReasonPlaceholder')}
                      value={reason}
                      variant="secondary"
                      maxLength={REASON_MAX_LENGTH}
                      rows={3}
                      onChange={e => setReason(e.target.value)}
                    />
                  </TextField>
                  <InfoNote tone="neutral">{t('itemRequestNote')}</InfoNote>
                  <RequestErrorAlert error={requestError} />
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                {t('cancel')}
              </Button>
              <Button variant="primary" onPress={handleRequest} isPending={isRequesting} isDisabled={!reason.trim()}>
                {t('submitRequest')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
