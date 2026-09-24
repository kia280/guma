'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Input,
  Label,
  Modal,
  NumberField,
  TextArea,
  TextField,
  type UseOverlayStateReturn,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import type { DateValue } from '@internationalized/date';
import { getLocalTimeZone, parseAbsoluteToLocal } from '@internationalized/date';

import { apiClient } from '@/lib/guma';
import { useCurrentGuildId } from '@/lib/current-guild';
import type { Lottery } from '@/types/lottery';

type CreateLotteryModalProps = {
  state: UseOverlayStateReturn;
  prizeItemName?: string | null;
  onCreated?: (lottery: Lottery) => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function defaultDrawDate() {
  const date = new Date(Date.now() + 3 * DAY_MS);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export function CreateLotteryModal({ state, prizeItemName, onCreated }: CreateLotteryModalProps) {
  const t = useTranslations('createLotteryModal');
  const guildId = useCurrentGuildId();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [ticketPrice, setTicketPrice] = React.useState(10);
  const [maxTickets, setMaxTickets] = React.useState(100);
  const [prizeName, setPrizeName] = React.useState('');
  const [prizeAmount, setPrizeAmount] = React.useState(0);
  const [drawDate, setDrawDate] = React.useState(defaultDrawDate);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!state.isOpen) return;
    setTitle(prizeItemName ? t('titleFromItem', { item: prizeItemName }) : '');
    setDescription('');
    setTicketPrice(10);
    setMaxTickets(100);
    setPrizeName(prizeItemName ?? '');
    setPrizeAmount(prizeItemName ? 0 : 1000);
    setDrawDate(defaultDrawDate());
    setError('');
  }, [state.isOpen, prizeItemName, t]);

  const isFuture = new Date(drawDate).getTime() > Date.now();
  const canSubmit =
    title.trim() !== '' && ticketPrice > 0 && maxTickets > 0 && isFuture && (prizeName.trim() !== '' || prizeAmount > 0);

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
          {
            rank: 1,
            description: prizeName.trim() || `$${prizeAmount.toLocaleString('en-US')}`,
            amount: prizeAmount > 0 ? prizeAmount : undefined,
          },
        ],
      });
      onCreated?.(lottery);
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
            <Modal.Body className="p-1">
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

                <div className="grid grid-cols-2 gap-3">
                  <TextField>
                    <Label>{t('prizeName')}</Label>
                    <Input
                      variant="secondary"
                      placeholder={t('prizeNamePlaceholder')}
                      value={prizeName}
                      onChange={event => setPrizeName(event.target.value)}
                    />
                  </TextField>
                  <NumberField minValue={0} value={prizeAmount} onChange={value => setPrizeAmount(Number.isFinite(value) ? value : 0)}>
                    <Label>{t('prizeAmount')}</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-full min-w-0" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                  </NumberField>
                  <NumberField isRequired minValue={1} value={ticketPrice} onChange={value => setTicketPrice(Number.isFinite(value) ? value : 0)}>
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

                <DatePicker
                  isRequired
                  granularity="minute"
                  hourCycle={24}
                  isInvalid={!isFuture}
                  value={parseAbsoluteToLocal(drawDate)}
                  onChange={(value: DateValue | null) => {
                    if (value) setDrawDate(value.toDate(getLocalTimeZone()).toISOString());
                  }}
                >
                  <Label>{t('drawDate')}</Label>
                  <DateField.Group fullWidth>
                    <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label={t('drawDate')}>
                      <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                          <Calendar.YearPickerTriggerHeading />
                          <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                      </Calendar.Header>
                      <Calendar.Grid>
                        <Calendar.GridHeader>{day => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                        <Calendar.GridBody>{date => <Calendar.Cell date={date} />}</Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
                {!isFuture && <p className="type-caption text-danger">{t('drawDateInPast')}</p>}

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
