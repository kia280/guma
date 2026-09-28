'use client';

import { Calendar, DateField, DatePicker, Description, FieldError, Input, Label, TextArea, TextField } from '@heroui/react';
import { getLocalTimeZone, parseAbsoluteToLocal, type DateValue } from '@internationalized/date';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useNow } from '@/hooks/useNow';

export interface RollCallFormValues {
  title: string;
  description: string;
  datetime: string;
  expireTime: string;
  imageUrl: string;
}

export interface RollCallFormErrors {
  title: string | null;
  datetime: string | null;
  expireTime: string | null;
  isExpireOrderInvalid: boolean;
}

export function useRollCallFormErrors(
  values: RollCallFormValues,
  { requireFutureExpire = false }: { requireFutureExpire?: boolean } = {},
): RollCallFormErrors {
  const t = useTranslations('rollCall');
  const now = useNow(30_000);
  const expireBeforeStart =
    Boolean(values.datetime && values.expireTime) && new Date(values.expireTime) <= new Date(values.datetime);
  const expireInPast =
    requireFutureExpire && Boolean(values.expireTime) && new Date(values.expireTime).getTime() <= now;
  return {
    title: values.title.trim() ? null : t('titleRequired'),
    datetime: values.datetime ? null : t('eventDateTimeRequired'),
    expireTime: !values.expireTime
      ? t('expireTimeRequired')
      : expireBeforeStart
        ? t('expireBeforeStart')
        : expireInPast
          ? t('expireInPast')
          : null,
    isExpireOrderInvalid: expireBeforeStart || expireInPast,
  };
}

export const hasRollCallFormErrors = (errors: RollCallFormErrors) =>
  Boolean(errors.title || errors.datetime || errors.expireTime);

function DateTimeField({
  label,
  value,
  onChange,
  error,
  showError,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  showError: boolean;
  description?: string;
}) {
  return (
    <DatePicker
      isRequired
      validationBehavior="aria"
      isInvalid={showError}
      granularity="minute"
      hourCycle={24}
      value={value ? parseAbsoluteToLocal(new Date(value).toISOString()) : null}
      onChange={(val: DateValue | null) => {
        onChange(val ? val.toDate(getLocalTimeZone()).toISOString() : '');
      }}
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>
          {(segment) => <DateField.Segment segment={segment} />}
        </DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description && <Description>{description}</Description>}
      {showError && <FieldError>{error}</FieldError>}
      <DatePicker.Popover>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => <Calendar.Cell date={date} />}
            </Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

export function RollCallFormFields({
  values,
  errors,
  showErrors,
  onChange,
  onDatetimeChange,
  header,
  loot,
  footer,
}: {
  values: RollCallFormValues;
  errors: RollCallFormErrors;
  showErrors: boolean;
  onChange: (updates: Partial<RollCallFormValues>) => void;
  onDatetimeChange?: (datetime: string) => void;
  header?: React.ReactNode;
  loot?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const t = useTranslations('rollCall');
  const showTitleError = Boolean(errors.title) && showErrors;
  const showDatetimeError = Boolean(errors.datetime) && showErrors;
  const showExpireTimeError = Boolean(errors.expireTime) && (showErrors || errors.isExpireOrderInvalid);

  return (
    <form className="flex flex-col gap-4" onSubmit={e => e.preventDefault()}>
      {header}
      <TextField isRequired validationBehavior="aria" isInvalid={showTitleError}>
        <Label>{t('title')}</Label>
        <Input
          placeholder={t('titlePlaceholder')}
          value={values.title}
          onChange={e => onChange({ title: e.target.value })}
          variant="secondary"
          autoFocus
        />
        {showTitleError && <FieldError>{errors.title}</FieldError>}
      </TextField>
      <TextField>
        <Label>{t('description')}</Label>
        <TextArea
          placeholder={t('descriptionPlaceholder')}
          value={values.description}
          onChange={e => onChange({ description: e.target.value })}
          variant="secondary"
          rows={2}
        />
      </TextField>
      <DateTimeField
        label={t('eventDateTime')}
        value={values.datetime}
        onChange={datetime => (onDatetimeChange ? onDatetimeChange(datetime) : onChange({ datetime }))}
        error={errors.datetime}
        showError={showDatetimeError}
      />
      <DateTimeField
        label={t('expireTime')}
        value={values.expireTime}
        onChange={expireTime => onChange({ expireTime })}
        error={errors.expireTime}
        showError={showExpireTimeError}
        description={t('expirePlaceholder')}
      />
      {loot}
      <TextField>
        <Label>{t('imageUrlPlaceholder')}</Label>
        <Input
          placeholder="https://..."
          value={values.imageUrl}
          onChange={e => onChange({ imageUrl: e.target.value })}
          variant="secondary"
        />
      </TextField>
      {footer}
    </form>
  );
}
