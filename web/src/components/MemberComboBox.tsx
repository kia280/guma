'use client';

import {
  ComboBox,
  Description,
  EmptyState,
  FieldError,
  Input,
  Label,
  ListBox,
  ListLayout,
  Virtualizer,
  buttonVariants,
  useFilter,
  type Key,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import React from 'react';
import { UserAvatar } from './UserAvatar';

const OPTION_ROW_HEIGHT = 52;

export interface MemberOption {
  id: string;
  name: string;
  avatar?: string;
  description?: string;
}

interface MemberComboBoxProps {
  members: MemberOption[];
  value: string;
  onChange: (memberId: string) => void;
  label: string;
  placeholder?: string;
  emptyMessage: string;
  isInvalid?: boolean;
  errorMessage?: string | null;
  className?: string;
}

const matchesExactly = (text: string, query: string) =>
  text.localeCompare(query, undefined, { sensitivity: 'base' }) === 0;

export const MemberComboBox = React.memo(function MemberComboBox({
  members,
  value,
  onChange,
  label,
  placeholder,
  emptyMessage,
  isInvalid = false,
  errorMessage,
  className,
}: MemberComboBoxProps) {
  const t = useTranslations('memberComboBox');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { contains } = useFilter({ sensitivity: 'base' });
  const [inputValue, setInputValue] = React.useState(() => members.find(member => member.id === value)?.name ?? '');
  const [syncedValue, setSyncedValue] = React.useState(value);
  const selectedMember = members.find(member => member.id === value);

  if (value !== syncedValue) {
    const previousMember = members.find(member => member.id === syncedValue);
    setSyncedValue(value);
    if (selectedMember) setInputValue(selectedMember.name);
    else if (!previousMember || inputValue === previousMember.name) setInputValue('');
  }

  const query = selectedMember?.name === inputValue ? '' : inputValue.trim();
  const deferredQuery = React.useDeferredValue(query);
  const options = React.useMemo(
    () => (deferredQuery ? members.filter(member => contains(member.name, deferredQuery)) : members),
    [members, deferredQuery, contains],
  );

  const commit = (memberId: string) => {
    setSyncedValue(memberId);
    if (memberId !== value) onChange(memberId);
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (selectedMember?.name === text) return;
    const query = text.trim();
    const exactMatch = query ? members.find(member => matchesExactly(member.name, query)) : undefined;
    commit(exactMatch?.id ?? '');
  };

  const handleSelectionChange = (key: Key | null) => {
    const member = members.find(candidate => candidate.id === key);
    if (!member) return;
    setInputValue(member.name);
    commit(member.id);
  };

  const clearSearch = () => {
    setInputValue('');
    commit('');
    inputRef.current?.focus();
  };

  return (
    <ComboBox
      fullWidth
      allowsCustomValue
      allowsEmptyCollection
      menuTrigger="input"
      variant="secondary"
      validationBehavior="aria"
      className={className}
      isInvalid={isInvalid}
      items={options}
      value={value || null}
      onChange={handleSelectionChange}
      inputValue={inputValue}
      onInputChange={handleInputChange}
    >
      <Label>{label}</Label>
      <ComboBox.InputGroup className={query ? '[&_[data-slot=input]]:pe-16' : undefined}>
        <Input ref={inputRef} placeholder={placeholder} />
        {query && (
          <button
            type="button"
            aria-label={t('clearSearch')}
            className={buttonVariants({
              isIconOnly: true,
              size: 'sm',
              variant: 'ghost',
              className: 'absolute end-7 top-1/2 -translate-y-1/2',
            })}
            onClick={clearSearch}
          >
            <Icon icon="solar:close-circle-linear" width={16} aria-hidden />
          </button>
        )}
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover className="w-(--trigger-width)">
        <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: OPTION_ROW_HEIGHT }}>
          <ListBox
            className="max-h-72 overflow-y-auto"
            renderEmptyState={() => (
              <EmptyState>{members.length > 0 && query ? t('noMatches', { query }) : emptyMessage}</EmptyState>
            )}
          >
            {(member: MemberOption) => (
              <ListBox.Item id={member.id} textValue={member.name} className="min-h-12">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar name={member.name} src={member.avatar} className="size-6 shrink-0" />
                  <div className="flex min-w-0 flex-col">
                    <Label className="truncate">{member.name}</Label>
                    {member.description && <Description className="truncate">{member.description}</Description>}
                  </div>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </Virtualizer>
      </ComboBox.Popover>
      {isInvalid && errorMessage && <FieldError>{errorMessage}</FieldError>}
    </ComboBox>
  );
});
