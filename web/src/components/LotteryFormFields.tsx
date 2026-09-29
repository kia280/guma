'use client';

import { FieldError, Input, Label, NumberField, TextArea, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { GOLD_FORMAT_OPTIONS, GOLD_STEP } from '@/lib/guma/money';
import { useFormatGold } from '@/lib/guma/useFormatGold';
import { DateTimePicker } from './DateTimePicker';
import { FieldRow, LockedValue } from './FieldRow';

export interface LotteryFormValues {
  title: string;
  description: string;
  ticketPrice: number;
  maxTickets: number;
  drawDate: string;
}

export interface LotteryFormErrors {
  title?: string | null;
  ticketPrice?: string | null;
  maxTickets?: string | null;
  drawDate?: string | null;
}

export function LotteryFormFields({
  values,
  errors,
  onChange,
  prizes,
  ticketsLocked,
  ticketsHint,
  validationBehavior,
}: {
  values: LotteryFormValues;
  errors: LotteryFormErrors;
  onChange: (updates: Partial<LotteryFormValues>) => void;
  prizes?: React.ReactNode;
  ticketsLocked?: boolean;
  ticketsHint?: React.ReactNode;
  validationBehavior?: 'aria' | 'native';
}) {
  const t = useTranslations('createLotteryModal');
  const formatGold = useFormatGold();

  return (
    <>
      <TextField isRequired validationBehavior={validationBehavior} isInvalid={!!errors.title}>
        <Label>{t('lotteryTitle')}</Label>
        <Input
          variant="secondary"
          placeholder={t('lotteryTitlePlaceholder')}
          value={values.title}
          onChange={event => onChange({ title: event.target.value })}
          autoFocus
        />
        {errors.title && <FieldError>{errors.title}</FieldError>}
      </TextField>
      <TextField>
        <Label>{t('description')}</Label>
        <TextArea
          variant="secondary"
          rows={2}
          value={values.description}
          onChange={event => onChange({ description: event.target.value })}
        />
      </TextField>

      {prizes}

      <div className="flex flex-col gap-2">
        <FieldRow>
          {ticketsLocked ? (
            <>
              <LockedValue label={t('ticketPrice')} value={formatGold(values.ticketPrice)} />
              <LockedValue label={t('maxTickets')} value={String(values.maxTickets)} />
            </>
          ) : (
            <>
              <NumberField
                isRequired
                validationBehavior={validationBehavior}
                isInvalid={!!errors.ticketPrice}
                formatOptions={GOLD_FORMAT_OPTIONS}
                minValue={GOLD_STEP}
                value={values.ticketPrice}
                onChange={value => onChange({ ticketPrice: Number.isFinite(value) ? value : 0 })}
              >
                <Label>{t('ticketPrice')}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-full min-w-0" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                {errors.ticketPrice && <FieldError>{errors.ticketPrice}</FieldError>}
              </NumberField>
              <NumberField
                isRequired
                validationBehavior={validationBehavior}
                isInvalid={!!errors.maxTickets}
                minValue={1}
                value={values.maxTickets}
                onChange={value => onChange({ maxTickets: Number.isFinite(value) ? value : 0 })}
              >
                <Label>{t('maxTickets')}</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-full min-w-0" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                {errors.maxTickets && <FieldError>{errors.maxTickets}</FieldError>}
              </NumberField>
            </>
          )}
        </FieldRow>
        {ticketsHint}
      </div>

      <DateTimePicker
        isRequired
        label={t('drawDate')}
        value={values.drawDate}
        onChange={drawDate => onChange({ drawDate })}
        isInvalid={!!errors.drawDate}
        validationBehavior={validationBehavior}
        errorMessage={errors.drawDate ?? undefined}
      />
    </>
  );
}
