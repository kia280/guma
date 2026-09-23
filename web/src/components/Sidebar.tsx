'use client';

import { Accordion, ListBox, Tooltip, Label } from '@heroui/react';
import React from 'react';
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

export type SidebarProps = {
  items: SidebarItem[];
  isCompact?: boolean;
  hideEndContent?: boolean;
  iconClassName?: string;
  defaultSelectedKey: string;
  onSelect?: (key: string) => void;
  className?: string;
  itemClasses?: {
    base?: string;
    title?: string;
  };
};

const Sidebar = React.forwardRef<HTMLElement, SidebarProps>(
  (
    {
      items,
      isCompact,
      defaultSelectedKey,
      onSelect,
      hideEndContent,
      iconClassName,
      className,
      itemClasses,
    },
    ref
  ) => {
    const [selected, setSelected] = React.useState<string>(defaultSelectedKey);

    // Sync with external changes (e.g. route navigation)
    React.useEffect(() => {
      setSelected(defaultSelectedKey);
    }, [defaultSelectedKey]);

    const renderIcon = (item: SidebarItem, showTooltip = false) => {
      if (!item.icon) return item.startContent ?? null;
      const iconEl = (
        <Icon
          className={cn('text-hint', selected === item.key && 'text-foreground', iconClassName)}
          icon={item.icon}
          width={24}
        />
      );
      if (showTooltip && isCompact) {
        return (
          <Tooltip delay={0}>
            {iconEl}
            <Tooltip.Content>{item.title}</Tooltip.Content>
          </Tooltip>
        );
      }
      return iconEl;
    };

    const renderItem = (item: SidebarItem) => {
      const isSelected = selected === item.key;

      return (
        <ListBox.Item
          key={item.key}
          id={item.key}
          textValue={item.title}
          className={cn(
            'flex items-center rounded-large px-2 py-3.5 cursor-pointer min-h-[52px] h-[52px]',
            'transition-colors hover:bg-default',
            isSelected && 'bg-default',
            isCompact && 'h-[44px]',
            itemClasses?.base
          )}
        >
          <div className="flex items-center w-full">
            <div className="w-11 flex items-center justify-start shrink-0">
              {renderIcon(item, isCompact)}
            </div>
            {!isCompact && (
              <>
                <span
                  className={cn(
                    'text-small font-medium text-hint',
                    isSelected && 'text-foreground font-semibold',
                    itemClasses?.title
                  )}
                >
                  {item.title}
                </span>
                {!hideEndContent && item.endContent && (
                  <span className="ml-auto">{item.endContent}</span>
                )}
              </>
            )}
          </div>
        </ListBox.Item>
      );
    };

    const renderNestItem = (item: SidebarItem) => {
      if (!item.items?.length) return renderItem(item);

      if (isCompact) {
        return renderItem(item);
      }

      return (
        <ListBox.Item
          key={item.key}
          id={item.key}
          textValue={item.title}
          className="p-0 h-auto cursor-default"
        >
          <Accordion>
            <Accordion.Item>
              <Accordion.Heading>
                <Accordion.Trigger className="px-2 py-3 flex items-center w-full">
                  <div className="flex items-center w-full">
                    <div className="w-11 flex items-center justify-center shrink-0">
                      {item.icon && (
                        <Icon
                          className={cn('text-subtle', iconClassName)}
                          icon={item.icon}
                          width={24}
                        />
                      )}
                    </div>
                    <span className="text-small font-medium text-subtle">{item.title}</span>
                  </div>
                  <Accordion.Indicator />
                </Accordion.Trigger>
              </Accordion.Heading>
              <Accordion.Panel>
                <Accordion.Body className="pl-4">
                  <ListBox aria-label={item.title} className="border-l border-divider pl-2">
                    {item.items.map(renderItem)}
                  </ListBox>
                </Accordion.Body>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </ListBox.Item>
      );
    };

    return (
      <ListBox
        ref={ref as React.Ref<HTMLDivElement>}
        aria-label="Navigation"
        className={cn('list-none', className)}
        selectionMode="single"
        selectedKeys={new Set([selected])}
        onSelectionChange={keys => {
          const key = Array.from(keys as Set<string>)
            .values()
            .next().value as string;
          if (key != null) {
            setSelected(key);
            onSelect?.(key);
          }
        }}
      >
        {items.map(item =>
          item.items && item.items.length > 0 && item.type === SidebarItemType.Nest ? (
            renderNestItem(item)
          ) : item.items && item.items.length > 0 ? (
            <ListBox.Section key={item.key}>{item.items.map(renderItem)}</ListBox.Section>
          ) : (
            renderItem(item)
          )
        )}
      </ListBox>
    );
  }
);

Sidebar.displayName = 'Sidebar';

export { Sidebar };
