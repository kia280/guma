'use client';

import { Chip } from '@heroui/react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { create } from 'zustand';

import {
  applyDevFont,
  DEFAULT_FONT_ID,
  DEV_FONTS,
  getDevFontId,
  loadDevFont,
  saveDevFontId,
} from '@/lib/dev-font';

const useDevFontStore = create<{ fontId: string; setFontId: (id: string) => void }>((set) => ({
  fontId: DEFAULT_FONT_ID,
  setFontId: (id) => {
    saveDevFontId(id);
    set({ fontId: id });
  },
}));

export function useApplyDevFont() {
  const fontId = useDevFontStore((s) => s.fontId);

  useEffect(() => {
    useDevFontStore.setState({ fontId: getDevFontId() });
  }, []);

  useEffect(() => {
    applyDevFont(fontId);
  }, [fontId]);
}

export function DevFontPanel() {
  const t = useTranslations('devTools');
  const fontId = useDevFontStore((s) => s.fontId);
  const setFontId = useDevFontStore((s) => s.setFontId);

  useEffect(() => {
    DEV_FONTS.forEach(loadDevFont);
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-background p-4 text-foreground">
      <p className="type-body text-soft">{t('fontDescription')}</p>
      <div role="radiogroup" aria-label={t('fontTab')} className="grid gap-2 sm:grid-cols-2">
        {DEV_FONTS.map((font) => {
          const isSelected = font.id === fontId;
          return (
            <button
              key={font.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setFontId(font.id)}
              className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors ${
                isSelected ? 'border-accent bg-accent/10' : 'border-divider bg-surface hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="type-body font-medium">{t(`fonts.${font.id}.name`)}</span>
                {isSelected && (
                  <Chip size="sm" color="accent">
                    {t('active')}
                  </Chip>
                )}
              </div>
              <span className="type-caption text-soft">{t(`fonts.${font.id}.description`)}</span>
              <span className="type-heading" style={font.stack ? { fontFamily: font.stack } : undefined}>
                {t('fontSample')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
