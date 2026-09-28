'use client';

import { FieldError, Input, Label, ListBox, NumberField, Select, TextArea, TextField } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { GOLD_FORMAT_OPTIONS, GOLD_STEP } from '@/lib/guma/money';
import { ItemCategory, ItemRarity } from '@/types/item';

export interface AuctionItemValues {
  name: string;
  description: string;
  category: ItemCategory;
  rarity: ItemRarity;
}

export interface AuctionPricingValues {
  startingBid: number;
  minBidIncrement: number;
}

export function AuctionItemFields({
  values,
  onChange,
  nameError,
  autoFocus,
}: {
  values: AuctionItemValues;
  onChange: (updates: Partial<AuctionItemValues>) => void;
  nameError?: string | null;
  autoFocus?: boolean;
}) {
  const t = useTranslations('createAuctionModal');

  return (
    <>
      <TextField isRequired validationBehavior="aria" isInvalid={!!nameError}>
        <Label>{t('itemName')}</Label>
        <Input
          variant="secondary"
          placeholder={t('itemNamePlaceholder')}
          value={values.name}
          onChange={event => onChange({ name: event.target.value })}
          autoFocus={autoFocus}
        />
        {nameError && <FieldError>{nameError}</FieldError>}
      </TextField>
      <TextField>
        <Label>{t('description')}</Label>
        <TextArea
          variant="secondary"
          rows={2}
          placeholder={t('descriptionPlaceholder')}
          value={values.description}
          onChange={event => onChange({ description: event.target.value })}
        />
      </TextField>
      <div className="grid grid-cols-2 gap-3">
        <Select value={values.category} onChange={value => onChange({ category: value as ItemCategory })}>
          <Label>{t('category')}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.values(ItemCategory).map(category => (
                <ListBox.Item key={category} id={category} textValue={t(`categories.${category}`)}>
                  {t(`categories.${category}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
        <Select value={values.rarity} onChange={value => onChange({ rarity: value as ItemRarity })}>
          <Label>{t('rarity')}</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.values(ItemRarity).map(rarity => (
                <ListBox.Item key={rarity} id={rarity} textValue={t(`rarities.${rarity}`)}>
                  {t(`rarities.${rarity}`)}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </>
  );
}

function GoldField({
  label,
  value,
  onChange,
  error,
  isDisabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string | null;
  isDisabled?: boolean;
}) {
  return (
    <NumberField
      isRequired
      isDisabled={isDisabled}
      validationBehavior="aria"
      isInvalid={!!error}
      formatOptions={GOLD_FORMAT_OPTIONS}
      minValue={GOLD_STEP}
      value={value}
      onChange={next => onChange(Number.isFinite(next) ? next : 0)}
    >
      <Label>{label}</Label>
      <NumberField.Group>
        <NumberField.DecrementButton />
        <NumberField.Input className="w-full min-w-0" />
        <NumberField.IncrementButton />
      </NumberField.Group>
      {error && <FieldError>{error}</FieldError>}
    </NumberField>
  );
}

export function AuctionPricingFields({
  values,
  onChange,
  errors,
  isDisabled,
}: {
  values: AuctionPricingValues;
  onChange: (updates: Partial<AuctionPricingValues>) => void;
  errors?: { startingBid?: string | null; minBidIncrement?: string | null };
  isDisabled?: boolean;
}) {
  const t = useTranslations('createAuctionModal');

  return (
    <div className="grid grid-cols-2 gap-3">
      <GoldField
        label={t('startingBid')}
        value={values.startingBid}
        onChange={startingBid => onChange({ startingBid })}
        error={errors?.startingBid}
        isDisabled={isDisabled}
      />
      <GoldField
        label={t('minBidIncrement')}
        value={values.minBidIncrement}
        onChange={minBidIncrement => onChange({ minBidIncrement })}
        error={errors?.minBidIncrement}
        isDisabled={isDisabled}
      />
    </div>
  );
}
