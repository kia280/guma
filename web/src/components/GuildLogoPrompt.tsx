'use client';

import React from 'react';
import { Button, Disclosure } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

const FALLBACK_COLOR = '#998800';

const accentHex = () => {
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  if (!accent || !context) return FALLBACK_COLOR;
  context.fillStyle = FALLBACK_COLOR;
  context.fillStyle = accent;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

const copyWithSelection = (text: string) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
};

export function GuildLogoPrompt({ guildName }: { guildName: string }) {
  const t = useTranslations('adminPage');
  const [color, setColor] = React.useState(FALLBACK_COLOR);
  const [isCopied, setIsCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);

  React.useEffect(() => {
    if (!isCopied) return;
    const timer = window.setTimeout(() => setIsCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  const prompt = t('logoPrompt', { name: guildName, color });

  const copyPrompt = async () => {
    setCopyFailed(false);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
      } else if (!copyWithSelection(prompt)) {
        throw new Error('copy failed');
      }
      setIsCopied(true);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <Disclosure onExpandedChange={isExpanded => { if (isExpanded) setColor(accentHex()); }}>
      <Disclosure.Heading>
        <Button slot="trigger" size="sm" variant="ghost">
          <Icon icon="solar:magic-stick-3-linear" width={16} aria-hidden />
          {t('logoPromptToggle')}
          <Disclosure.Indicator />
        </Button>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="space-y-3 pt-2">
          <p className="type-caption text-hint">{t('logoPromptHelp')}</p>
          <p className="type-body whitespace-pre-wrap rounded-lg bg-surface-secondary p-3 text-foreground">{prompt}</p>
          {copyFailed && (
            <p role="alert" className="type-caption text-danger">
              {t('logoPromptCopyFailed')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onPress={copyPrompt}>
              <Icon icon={isCopied ? 'solar:check-circle-linear' : 'solar:copy-linear'} width={16} aria-hidden />
              {isCopied ? t('logoPromptCopied') : t('logoPromptCopy')}
            </Button>
            <a
              href="https://chatgpt.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 type-body text-accent hover:bg-accent/10"
            >
              <Icon icon="solar:square-top-down-linear" width={16} aria-hidden />
              {t('logoOpenChatGpt')}
            </a>
          </div>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
