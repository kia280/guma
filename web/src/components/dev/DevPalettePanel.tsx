'use client';

import { Chip } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import {
  DEFAULT_PALETTE,
  getPalette,
  PALETTES,
  setPalette,
  subscribePalette,
  type Palette,
} from '@/lib/dev-palette';

function PalettePreview({ palette }: { palette: Palette }) {
  return (
    <span
      data-palette={palette}
      aria-hidden="true"
      className="flex h-16 gap-1.5 rounded-lg border border-divider bg-background p-1.5"
    >
      <span className="flex w-4 flex-col gap-1 pt-1">
        <span className="h-1.5 rounded-full bg-accent" />
        <span className="h-1.5 rounded-full bg-muted/40" />
        <span className="h-1.5 rounded-full bg-muted/40" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between rounded-md border border-divider bg-surface p-1.5">
        <span className="flex flex-col gap-1">
          <span className="h-1.5 w-3/4 rounded-full bg-foreground" />
          <span className="h-1.5 w-1/2 rounded-full bg-muted/60" />
        </span>
        <span className="flex items-center justify-between gap-1">
          <span className="h-3 w-8 rounded-full bg-accent" />
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="size-1.5 rounded-full bg-warning" />
            <span className="size-1.5 rounded-full bg-danger" />
          </span>
        </span>
      </span>
    </span>
  );
}

export function DevPalettePanel() {
  const t = useTranslations('devTools');
  const paletteId = useSyncExternalStore(subscribePalette, getPalette, () => DEFAULT_PALETTE);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-foreground">
      <p className="type-body text-soft">{t('paletteDescription')}</p>
      <div
        role="radiogroup"
        aria-label={t('paletteTab')}
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {PALETTES.map(palette => {
          const isSelected = palette === paletteId;
          return (
            <button
              key={palette}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setPalette(palette)}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                isSelected
                  ? 'border-accent bg-accent/10'
                  : 'border-divider bg-surface hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 type-body">
                <span className="font-medium">{t(`palettes.${palette}.name`)}</span>
                {isSelected && (
                  <Chip size="sm" color="accent">
                    {t('active')}
                  </Chip>
                )}
              </div>
              <span className="type-caption text-soft">{t(`palettes.${palette}.description`)}</span>
              <PalettePreview palette={palette} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
