'use client';

import { Calendar, DateField, DatePicker, Description, FieldError, Label } from '@heroui/react';
import type { DateValue } from '@internationalized/date';
import { getLocalTimeZone, parseAbsoluteToLocal } from '@internationalized/date';

type DateTimePickerProps = {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  isRequired?: boolean;
  isInvalid?: boolean;
  validationBehavior?: 'aria' | 'native';
  description?: string;
  errorMessage?: string;
  className?: string;
};

export function DateTimePicker({
  label,
  value,
  onChange,
  isRequired,
  isInvalid,
  validationBehavior,
  description,
  errorMessage,
  className,
}: DateTimePickerProps) {
  return (
    <DatePicker
      className={className}
      isRequired={isRequired}
      isInvalid={isInvalid}
      validationBehavior={validationBehavior}
      granularity="minute"
      hourCycle={24}
      value={value ? parseAbsoluteToLocal(new Date(value).toISOString()) : null}
      onChange={(next: DateValue | null) => {
        if (next) onChange(next.toDate(getLocalTimeZone()).toISOString());
      }}
    >
      <Label>{label}</Label>
      <DateField.Group fullWidth>
        <DateField.Input>{segment => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      {description && <Description>{description}</Description>}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
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
  );
}
