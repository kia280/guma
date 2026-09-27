'use client';

import { Chip } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { create } from 'zustand';
import {
  applyDevPalette,
  DEFAULT_PALETTE_ID,
  DEV_PALETTES,
  getDevPaletteId,
  saveDevPaletteId,
  type DevPalette,
} from '@/lib/dev-palette';

const SWATCH_TOKENS = ['--accent', '--background', '--surface-secondary', '--success', '--warning', '--danger'] as const;

const useDevPaletteStore = create<{ paletteId: string; setPaletteId: (id: string) => void }>((set) => ({
  paletteId: DEFAULT_PALETTE_ID,
  setPaletteId: (id) => {
    saveDevPaletteId(id);
    set({ paletteId: id });
  },
}));

export function useApplyDevPalette() {
  const { resolvedTheme } = useTheme();
  const paletteId = useDevPaletteStore((s) => s.paletteId);

  useEffect(() => {
    useDevPaletteStore.setState({ paletteId: getDevPaletteId() });
  }, []);

  useEffect(() => {
    applyDevPalette(paletteId, resolvedTheme === 'light');
  }, [paletteId, resolvedTheme]);
}

function Swatches({ palette }: { palette: DevPalette }) {
  return (
    <div className="flex gap-1" aria-hidden="true">
      {SWATCH_TOKENS.map((token) => (
        <span
          key={token}
          className="h-5 w-5 rounded-md border border-divider"
          style={{ background: palette.tokens[token] ?? `var(${token})` }}
        />
      ))}
    </div>
  );
}

export function DevPalettePanel() {
  const t = useTranslations('devTools');
  const { resolvedTheme } = useTheme();
  const paletteId = useDevPaletteStore((s) => s.paletteId);
  const setPaletteId = useDevPaletteStore((s) => s.setPaletteId);
  const isLight = resolvedTheme === 'light';

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-foreground">
      <p className="type-body text-soft">{t('paletteDescription')}</p>
      {!isLight && (
        <p role="status" className="rounded-lg bg-warning/10 px-3 py-2 type-body text-foreground">
          {t('paletteLightOnly')}
        </p>
      )}
      <div role="radiogroup" aria-label={t('paletteTab')} className="grid gap-2 sm:grid-cols-2">
        {DEV_PALETTES.map((palette) => {
          const isSelected = palette.id === paletteId;
          return (
            <button
              key={palette.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setPaletteId(palette.id)}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                isSelected ? 'border-accent bg-accent/10' : 'border-divider bg-surface hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 type-body">
                <span className="font-medium">{t(`palettes.${palette.id}.name`)}</span>
                {isSelected && (
                  <Chip size="sm" color="accent">
                    {t('active')}
                  </Chip>
                )}
              </div>
              <span className="type-caption text-soft">{t(`palettes.${palette.id}.description`)}</span>
              <Swatches palette={palette} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
