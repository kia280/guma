'use client';

import {
  Button,
  Input,
  Label,
  Modal,
  NumberField,
  Tabs,
  TextArea,
  TextField,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useToast } from '@/hooks/useToast';
import { useCurrentGuildId } from '@/lib/current-guild';
import { apiClient } from '@/lib/guma';
import { GOLD_FORMAT_OPTIONS, GOLD_STEP } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import type { GuildBankItem } from '@/types/guild-bank';
import type { ItemSourceRef } from '@/types/item';
import type { Lottery } from '@/types/lottery';
import { BankItemPicker } from './BankItemPicker';
import { DateTimePicker } from './DateTimePicker';

export type LotteryPrizeItem = {
  name: string;
  source: ItemSourceRef;
};

type PrizeMode = 'manual' | 'bank';

type CreateLotteryModalProps = {
  state: UseOverlayStateReturn;
  prizeItem?: LotteryPrizeItem | null;
  onCreated?: (lottery: Lottery) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function defaultDrawDate() {
  const date = new Date(Date.now() + 3 * DAY_MS);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function CreateLotteryModal({ state, prizeItem, onCreated }: CreateLotteryModalProps) {
  const t = useTranslations('createLotteryModal');
  const notify = useToast();
  const formatGold = useFormatGold();
  const guildId = useCurrentGuildId();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ticketPrice, setTicketPrice] = React.useState(10);
  const [maxTickets, setMaxTickets] = React.useState(100);
  const [prizeName, setPrizeName] = React.useState('');
  const [prizeAmount, setPrizeAmount] = React.useState(0);
  const [prizeMode, setPrizeMode] = React.useState<PrizeMode>('manual');
  const [bankItem, setBankItem] = React.useState<GuildBankItem | null>(null);
  const [drawDate, setDrawDate] = React.useState(defaultDrawDate);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!state.isOpen) return;
    setTitle(prizeItem ? t('titleFromItem', { item: prizeItem.name }) : '');
    setDescription('');
    setTicketPrice(10);
    setMaxTickets(100);
    setPrizeName(prizeItem?.name ?? '');
    setPrizeAmount(prizeItem ? 0 : 1000);
    setPrizeMode('manual');
    setBankItem(null);
    setDrawDate(defaultDrawDate());
    setError('');
  }, [state.isOpen, prizeItem, t]);

  const isFromBank = !prizeItem && prizeMode === 'bank';
  const lockedPrize: LotteryPrizeItem | null = prizeItem
    ?? (isFromBank && bankItem ? { name: bankItem.name, source: { bankItemId: bankItem.id } } : null);
  const hasPrize = isFromBank ? !!lockedPrize : prizeName.trim() !== '' || prizeAmount > 0;

  const isFuture = new Date(drawDate).getTime() > Date.now();
  const canSubmit = title.trim() !== '' && ticketPrice > 0 && maxTickets > 0 && isFuture && hasPrize;

  const selectBankItem = (item: GuildBankItem | null) => {
    setBankItem(item);
    if (item && title.trim() === '') setTitle(t('titleFromItem', { item: item.name }));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError('');
    try {
      const lottery = await apiClient.createLottery(guildId, {
        title: title.trim(),
        description: description.trim() || undefined,
        ticketPrice,
        maxTickets,
        drawDate,
        prizes: [
          lockedPrize
            ? { rank: 1, description: lockedPrize.name, source: lockedPrize.source }
            : {
                rank: 1,
                description: prizeName.trim() || formatGold(prizeAmount),
                amount: prizeAmount > 0 ? prizeAmount : undefined,
              },
        ],
      });
      onCreated?.(lottery);
      notify.success(t('created'));
      state.close();
    } catch {
      setError(t('createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header className="flex-col items-start gap-1">
              <h2 className="type-heading text-foreground">{t('title')}</h2>
              <p className="type-caption text-hint">{t('subtitle')}</p>
            </Modal.Header>
            <Modal.Body>
              <form
                className="flex flex-col gap-4"
                onSubmit={event => {
                  event.preventDefault();
                  submit();
                }}
              >
                <TextField isRequired>
                  <Label>{t('lotteryTitle')}</Label>
                  <Input
                    variant="secondary"
                    placeholder={t('lotteryTitlePlaceholder')}
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    autoFocus
                  />
                </TextField>
                <TextField>
                  <Label>{t('description')}</Label>
                  <TextArea
                    variant="secondary"
                    rows={2}
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                  />
                </TextField>

                {!prizeItem && (
                  <Tabs variant="secondary" selectedKey={prizeMode} onSelectionChange={key => setPrizeMode(key as PrizeMode)}>
                    <Tabs.ListContainer>
                      <Tabs.List aria-label={t('prizeSource')}>
                        <Tabs.Tab id="manual">
                          {t('prizeSourceManual')}
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="bank">
                          {t('prizeSourceBank')}
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                )}
                {isFromBank && <BankItemPicker value={bankItem} onChange={selectBankItem} />}
                {lockedPrize && (
                  <div className="flex items-center gap-3 rounded-xl border border-divider bg-surface-secondary p-3">
                    <Icon icon="solar:gift-linear" width={20} className="text-subtle shrink-0" aria-hidden />
                    <div className="min-w-0">
                      <p className="type-body font-medium text-foreground truncate">{lockedPrize.name}</p>
                      <p className="type-caption text-hint">
                        {t(lockedPrize.source.bankItemId ? 'prizeFromBankHint' : 'prizeFromBackpackHint')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {!lockedPrize && !isFromBank && (
                    <>
                      <TextField>
                        <Label>{t('prizeName')}</Label>
                        <Input
                          variant="secondary"
                          placeholder={t('prizeNamePlaceholder')}
                          value={prizeName}
                          onChange={event => setPrizeName(event.target.value)}
                        />
                      </TextField>
                      <NumberField formatOptions={GOLD_FORMAT_OPTIONS} minValue={0} value={prizeAmount} onChange={value => setPrizeAmount(Number.isFinite(value) ? value : 0)}>
                        <Label>{t('prizeAmount')}</Label>
                        <NumberField.Group>
                          <NumberField.DecrementButton />
                          <NumberField.Input className="w-full min-w-0" />
                          <NumberField.IncrementButton />
                        </NumberField.Group>
                      </NumberField>
                    </>
                  )}
                  <NumberField isRequired formatOptions={GOLD_FORMAT_OPTIONS} minValue={GOLD_STEP} value={ticketPrice} onChange={value => setTicketPrice(Number.isFinite(value) ? value : 0)}>
                    <Label>{t('ticketPrice')}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-full min-w-0" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <NumberField isRequired minValue={1} value={maxTickets} onChange={value => setMaxTickets(Number.isFinite(value) ? value : 0)}>
                    <Label>{t('maxTickets')}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-full min-w-0" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                </div>

                <DateTimePicker
                  isRequired
                  label={t('drawDate')}
                  value={drawDate}
                  onChange={setDrawDate}
                  isInvalid={!isFuture}
                  errorMessage={t('drawDateInPast')}
                />

                {error && (
                  <p role="alert" className="type-caption text-danger">
                    {error}
                  </p>
                )}
              </form>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onPress={state.close}>
                {t('cancel')}
              </Button>
              <Button isDisabled={!canSubmit} isPending={isSubmitting} onPress={submit}>
                <Icon icon="solar:ticket-linear" width={16} />
                {t('create')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
