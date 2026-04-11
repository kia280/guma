'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Switch, Label } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

export default function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const t = useTranslations('ThemeSwitcher');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <Switch isSelected={isDark} onChange={() => setTheme(isDark ? 'light' : 'dark')}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <Label className="text-sm">{t('DarkTheme')}</Label>
      </Switch.Content>
    </Switch>
  );
}
