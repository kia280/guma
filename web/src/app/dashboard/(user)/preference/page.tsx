'use client';

import React from 'react';
import { Card, Switch, Select, Separator, Label, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { FONT_SIZES, getFontSize, setFontSize, type FontSize } from '@/lib/font-size';
import { HTML_LANG, LOCALE_COOKIE, LOCALE_LABELS, LOCALES, isLocale } from '@/i18n/locales';

const fontSizePreviewClass: Record<FontSize, string> = {
  default: 'text-sm',
  large: 'text-base',
  'x-large': 'text-lg',
};

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export default function PreferencePage() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('preferencePage');
  const locale = useLocale();
  const router = useRouter();
  const handleLocaleChange = (value: unknown) => {
    if (!isLocale(value) || value === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    router.refresh();
  };
  const themeLabels: Record<string, string> = {
    light: t('themeLight'),
    dark: t('themeDark'),
    system: t('themeSystem'),
  };
  const [emailNotifications, setEmailNotifications] = React.useState(true);
  const [auctionAlerts, setAuctionAlerts] = React.useState(true);
  const [lotteryAlerts, setLotteryAlerts] = React.useState(true);
  const [eventReminders, setEventReminders] = React.useState(false);
  const [checkinReminders, setCheckinReminders] = React.useState(true);
  const [fontSize, setFontSizeState] = React.useState<FontSize>('default');
  const fontSizeLabels: Record<FontSize, string> = {
    default: t('fontSizeDefault'),
    large: t('fontSizeLarge'),
    'x-large': t('fontSizeXLarge'),
  };

  React.useEffect(() => {
    setFontSizeState(getFontSize());
  }, []);

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    setFontSizeState(size);
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header */}
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Appearance */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:palette-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('appearance')}</p>
            <p className="type-caption text-hint">{t('appearanceSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map(themeKey => (
              <button
                key={themeKey}
                onClick={() => setTheme(themeKey)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === themeKey
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-divider bg-surface-secondary text-subtle hover:border-foreground/20'
                }`}
              >
                <Icon
                  icon={
                    themeKey === 'light'
                      ? 'solar:sun-bold'
                      : themeKey === 'dark'
                        ? 'solar:moon-bold'
                        : 'solar:monitor-bold'
                  }
                  width={20}
                />
                <span className="type-label capitalize">{themeLabels[themeKey]}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p id="font-size-label" className="type-body text-foreground">{t('fontSize')}</p>
            <div role="group" aria-labelledby="font-size-label" className="grid grid-cols-3 gap-3">
              {FONT_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  aria-pressed={fontSize === size}
                  onClick={() => handleFontSizeChange(size)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                    fontSize === size
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-divider bg-surface-secondary text-subtle hover:border-foreground/20'
                  }`}
                >
                  <span className={`${fontSizePreviewClass[size]} font-semibold`} aria-hidden="true">
                    Aa
                  </span>
                  <span className="type-label">{fontSizeLabels[size]}</span>
                </button>
              ))}
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Language */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:global-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('language')}</p>
            <p className="type-caption text-hint">{t('languageSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          <Select value={locale} onChange={handleLocaleChange} className="max-w-xs">
            <Label>{t('displayLanguage')}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {LOCALES.map(code => (
                  <ListBox.Item key={code} id={code} textValue={LOCALE_LABELS[code]} lang={HTML_LANG[code]}>
                    {LOCALE_LABELS[code]}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Card.Content>
      </Card>

      {/* Notifications */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:bell-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('notifications')}</p>
            <p className="type-caption text-hint">{t('notificationsSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-1">
          {[
            {
              key: 'email',
              label: t('emailLabel'),
              description: t('emailDesc'),
              icon: 'solar:letter-linear',
              value: emailNotifications,
              onChange: setEmailNotifications,
            },
            {
              key: 'auction',
              label: t('auctionLabel'),
              description: t('auctionDesc'),
              icon: 'solar:currency-dollar-linear',
              value: auctionAlerts,
              onChange: setAuctionAlerts,
            },
            {
              key: 'lottery',
              label: t('lotteryLabel'),
              description: t('lotteryDesc'),
              icon: 'solar:ticket-linear',
              value: lotteryAlerts,
              onChange: setLotteryAlerts,
            },
            {
              key: 'events',
              label: t('eventsLabel'),
              description: t('eventsDesc'),
              icon: 'solar:calendar-linear',
              value: eventReminders,
              onChange: setEventReminders,
            },
            {
              key: 'checkin',
              label: t('checkinLabel'),
              description: t('checkinDesc'),
              icon: 'solar:clipboard-list-linear',
              value: checkinReminders,
              onChange: setCheckinReminders,
            },
          ].map((item, idx, arr) => (
            <React.Fragment key={item.key}>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Icon icon={item.icon} width={16} className="text-hint shrink-0" />
                  <div>
                    <p className="type-body text-foreground">{item.label}</p>
                    <p className="type-caption text-hint">{item.description}</p>
                  </div>
                </div>
                <Switch isSelected={item.value} onChange={item.onChange} size="sm">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              {idx < arr.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </Card.Content>
      </Card>
    </div>
  );
}
