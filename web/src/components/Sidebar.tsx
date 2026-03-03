'use client';

import {
  Accordion,
  AccordionItem,
  type ListboxProps,
  type ListboxSectionProps,
  type Selection,
} from '@heroui/react';
import React from 'react';
import { Listbox, Tooltip, ListboxItem, ListboxSection } from '@heroui/react';
import { Icon } from '@iconify/react';
import { cn } from '@heroui/react';

export enum SidebarItemType {
  Nest = 'nest',
}

export type SidebarItem = {
  key: string;
  title: string;
  icon?: string;
  href?: string;
  type?: SidebarItemType.Nest;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  items?: SidebarItem[];
  className?: string;
};

export type SidebarProps = Omit<ListboxProps<SidebarItem>, 'children'> & {
  items: SidebarItem[];
  isCompact?: boolean;
  hideEndContent?: boolean;
  iconClassName?: string;
  sectionClasses?: ListboxSectionProps['classNames'];
  classNames?: ListboxProps['classNames'];
  defaultSelectedKey: string;
  onSelect?: (key: string) => void;
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      items,
      isCompact,
      defaultSelectedKey,
      onSelect,
      hideEndContent,
      sectionClasses: sectionClassesProp = {},
      itemClasses: itemClassesProp = {},
      iconClassName,
      classNames,
      className,
      ...props
    },
    ref
  ) => {
    const [selected, setSelected] = React.useState<React.Key>(defaultSelectedKey);

    const sectionClasses = {
      ...sectionClassesProp,
      base: cn(sectionClassesProp?.base, 'w-full', { 'p-0 max-w-[44px]': isCompact }),
      group: cn(sectionClassesProp?.group, {
        'flex flex-col gap-1': isCompact,
      }),
      heading: cn(sectionClassesProp?.heading, {
        hidden: isCompact,
      }),
    };

    const itemClasses = {
      ...itemClassesProp,
      base: cn(itemClassesProp?.base, 'p-0', { 'w-[44px] h-[44px] gap-0': isCompact }),
    };

    const renderNestItem = React.useCallback(
      (item: SidebarItem) => {
        const isNestType =
          item.items && item.items?.length > 0 && item?.type === SidebarItemType.Nest;

        if (isNestType) {
          // Is a nest type item , so we need to remove the href
          delete item.href;
        }

        return (
          <ListboxItem
            {...item}
            key={item.key}
            classNames={{
              base: cn(
                {
                  'h-auto p-0': !isCompact && isNestType,
                },
                {
                  'inline-block w-[44px]': isCompact && isNestType,
                }
              ),
            }}
            endContent={
              isCompact || isNestType || hideEndContent ? null : (item.endContent ?? null)
            }
            startContent={
              isNestType ? null : item.icon ? (
                isCompact ? (
                  <Tooltip content={item.title} placement="right">
                    <Icon
                      className={cn(
                        'text-default-500 group-data-[selected=true]:text-foreground',
                        iconClassName
                      )}
                      icon={item.icon}
                      width={24}
                    />
                  </Tooltip>
                ) : (
                  <Icon
                    className={cn(
                      'text-default-500 group-data-[selected=true]:text-foreground',
                      iconClassName
                    )}
                    icon={item.icon}
                    width={24}
                  />
                )
              ) : (
                (item.startContent ?? null)
              )
            }
            title={isCompact || isNestType ? null : item.title}
          >
            {!isCompact && isNestType ? (
              <Accordion className={'p-0'}>
                <AccordionItem
                  key={item.key}
                  aria-label={item.title}
                  classNames={{
                    heading: 'pr-3',
                    trigger: 'p-0',
                    content: 'py-0 pl-4',
                  }}
                  title={
                    item.icon ? (
                      <div className="flex items-center w-full">
                        <div className="w-[44px] flex items-center justify-center shrink-0">
                          <Icon
                            className={cn(
                              'text-default-500 group-data-[selected=true]:text-foreground',
                              iconClassName
                            )}
                            icon={item.icon}
                            width={24}
                          />
                        </div>
                        <span className="text-small text-default-500 group-data-[selected=true]:text-foreground font-medium">
                          {item.title}
                        </span>
                      </div>
                    ) : (
                      (item.startContent ?? null)
                    )
                  }
                >
                  {item.items && item.items?.length > 0 ? (
                    <Listbox
                      className={'mt-0.5'}
                      classNames={{
                        list: cn('border-l border-default-200 pl-4'),
                      }}
                      items={item.items}
                      variant="flat"
                    >
                      {item.items.map(renderItem)}
                    </Listbox>
                  ) : (
                    renderItem(item)
                  )}
                </AccordionItem>
              </Accordion>
            ) : null}
          </ListboxItem>
        );
      },

      [isCompact, hideEndContent, iconClassName, items]
    );

    const renderItem = React.useCallback(
      (item: SidebarItem) => {
        const isNestType =
          item.items && item.items?.length > 0 && item?.type === SidebarItemType.Nest;

        if (isNestType) {
          return renderNestItem(item);
        }

        return (
          <ListboxItem
            {...item}
            key={item.key}
            endContent={isCompact || hideEndContent ? null : (item.endContent ?? null)}
            startContent={item.icon ? null : (item.startContent ?? null)}
            textValue={item.title}
            title={item.icon ? null : isCompact ? null : item.title}
            classNames={{
              base: "py-3 px-2"
            }}
          >
            {item.icon ? (
              isCompact ? (
                <Tooltip
                  content={item.title}
                  placement="right"
                >
                  <div className="w-11 flex items-center justify-start">
                    <Icon
                      className={cn(
                        'text-default-500 group-data-[selected=true]:text-foreground',
                        iconClassName
                      )}
                      icon={item.icon}
                      width={24}
                    />
                  </div>
                </Tooltip>
              ) : (
                <div className="flex items-center">
                  <div className="w-11 flex items-center justify-start">
                    <Icon
                      className={cn(
                        'text-default-500 group-data-[selected=true]:text-foreground',
                        iconClassName
                      )}
                      icon={item.icon}
                      width={24}
                    />
                  </div>
                  <span className="text-small font-medium text-default-500 group-data-[selected=true]:text-foreground">
                    {item.title}
                  </span>
                </div>
              )
            ) : null}
          </ListboxItem>
        );
      },

      [isCompact, hideEndContent, iconClassName, itemClasses?.base]
    );

    return (
      <Listbox
        key={isCompact ? 'compact' : 'default'}
        ref={ref}
        hideSelectedIcon
        as="nav"
        className={cn('list-none', className)}
        classNames={{
          ...classNames,
          list: cn('items-center', classNames?.list),
        }}
        color="default"
        itemClasses={{
          ...itemClasses,
          base: cn(
            'min-h-11 rounded-large h-[44px] data-[selected=true]:bg-default-100',
            itemClasses?.base
          ),
          title: cn(
            'text-small font-medium text-default-500 group-data-[selected=true]:text-foreground',
            itemClasses?.title
          ),
        }}
        items={items}
        selectedKeys={[selected] as unknown as Selection}
        selectionMode="single"
        variant="flat"
        onSelectionChange={keys => {
          const key = Array.from(keys)[0];

          setSelected(key as React.Key);
          onSelect?.(key as string);
        }}
        {...props}
      >
        {item => {
          return item.items && item.items?.length > 0 && item?.type === SidebarItemType.Nest ? (
            renderNestItem(item)
          ) : item.items && item.items?.length > 0 ? (
            <ListboxSection
              key={item.key}
              classNames={sectionClasses}
              showDivider={isCompact}
              title={item.title}
            >
              {item.items.map(renderItem)}
            </ListboxSection>
          ) : (
            renderItem(item)
          );
        }}
      </Listbox>
    );
  }
);

Sidebar.displayName = 'Sidebar';

export { Sidebar };
