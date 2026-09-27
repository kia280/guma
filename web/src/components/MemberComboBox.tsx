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
  useFilter,
  type Key,
} from '@heroui/react';
import React from 'react';
import type { MockUser } from '@/types/user';

const OPTION_ROW_HEIGHT = 52;

interface MemberComboBoxProps {
  members: MockUser[];
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
  const { contains } = useFilter({ sensitivity: 'base' });
  const [inputValue, setInputValue] = React.useState(() => members.find(member => member.id === value)?.username ?? '');
  const [syncedValue, setSyncedValue] = React.useState(value);
  const selectedMember = members.find(member => member.id === value);

  if (value !== syncedValue) {
    const previousMember = members.find(member => member.id === syncedValue);
    setSyncedValue(value);
    if (selectedMember) setInputValue(selectedMember.username);
    else if (!previousMember || inputValue === previousMember.username) setInputValue('');
  }

  const query = selectedMember?.username === inputValue ? '' : inputValue.trim();
  const deferredQuery = React.useDeferredValue(query);
  const options = React.useMemo(
    () =>
      deferredQuery
        ? members.filter(member => contains(member.username, deferredQuery) || contains(member.email, deferredQuery))
        : members,
    [members, deferredQuery, contains],
  );

  const commit = (memberId: string) => {
    setSyncedValue(memberId);
    if (memberId !== value) onChange(memberId);
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (selectedMember?.username === text) return;
    const query = text.trim();
    const exactMatch = query
      ? members.find(member => matchesExactly(member.username, query) || matchesExactly(member.email, query))
      : undefined;
    commit(exactMatch?.id ?? '');
  };

  const handleSelectionChange = (key: Key | null) => {
    const member = members.find(candidate => candidate.id === key);
    if (!member) return;
    setInputValue(member.username);
    commit(member.id);
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
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover className="w-(--trigger-width)">
        <Virtualizer layout={ListLayout} layoutOptions={{ rowHeight: OPTION_ROW_HEIGHT }}>
          <ListBox className="max-h-72 overflow-y-auto" renderEmptyState={() => <EmptyState>{emptyMessage}</EmptyState>}>
            {(member: MockUser) => (
              <ListBox.Item id={member.id} textValue={member.username}>
                <div className="flex min-w-0 flex-col">
                  <Label className="truncate">{member.username}</Label>
                  <Description className="truncate">{member.email}</Description>
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
