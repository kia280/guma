'use client';

import { Button, Card, Chip, cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import React from 'react';
import { ItemCategory, ItemRarity } from '@/types/item';
import { ItemThumbnail, getRarityColor } from './ItemThumbnail';

export type ItemCardSource = {
  icon: string;
  text: string;
  href?: string;
};

type ItemCardProps = {
  ref?: React.Ref<HTMLDivElement>;
  name: string;
  quantity?: number;
  category: ItemCategory;
  rarity: ItemRarity;
  imageUrl?: string;
  chips?: React.ReactNode;
  source?: ItemCardSource;
  actions?: React.ReactNode;
  isHighlighted?: boolean;
  children?: React.ReactNode;
};

export function ItemCard({
  ref,
  name,
  quantity = 1,
  category,
  rarity,
  imageUrl,
  chips,
  source,
  actions,
  isHighlighted = false,
  children,
}: ItemCardProps) {
  const labels = useTranslations('createAuctionModal');

  return (
    <Card
      ref={ref}
      className={cn(
        'border shadow-none bg-surface-secondary hover:border-foreground/20 transition-colors p-2 rounded-xl',
        isHighlighted ? 'border-accent ring-2 ring-accent/30' : 'border-divider',
      )}
    >
      <Card.Content className="flex flex-1 flex-row items-center gap-2.5 p-0">
        <ItemThumbnail category={category} rarity={rarity} imageUrl={imageUrl} />
        <div className="flex flex-1 min-w-0 flex-col self-stretch">
          <div className="flex items-center gap-2 type-body">
            <p className="flex-1 min-w-0 font-medium text-foreground truncate">
              {name}
              {quantity > 1 && <span className="text-hint tabular-nums"> ×{quantity}</span>}
            </p>
            <Chip size="sm" color={getRarityColor(rarity)} variant="secondary" className="shrink-0">
              {labels(`rarities.${rarity}`)}
            </Chip>
          </div>
          {chips && <div className="flex flex-wrap items-center gap-1 mt-0.5 type-caption">{chips}</div>}
          {children}
          {(source || actions) && (
            <div className="mt-auto flex min-h-5 items-center gap-1 pt-0.5">
              {source?.href ? (
                <Link
                  href={source.href}
                  title={source.text}
                  className="flex min-w-0 items-center gap-1 rounded type-caption text-hint hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <Icon icon={source.icon} width={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{source.text}</span>
                </Link>
              ) : source ? (
                <p className="flex min-w-0 items-center gap-1 type-caption text-hint">
                  <Icon icon={source.icon} width={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{source.text}</span>
                </p>
              ) : null}
              {actions && <div className="ml-auto -mr-1 flex shrink-0 items-center">{actions}</div>}
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

export function ItemCardAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      {...props}
      className={cn('text-hint shrink-0 -my-1 size-7 max-sm:-my-3 max-sm:size-11', className)}
    />
  );
}
