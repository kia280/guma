'use client';

import { Button, Card, Switch, Select, Separator, Label, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import React from 'react';
import { PageHeader } from '@/components/PageHeader';
import { HTML_LANG, LOCALE_COOKIE, LOCALE_LABELS, LOCALES, isLocale } from '@/i18n/locales';
import { FONT_SIZES, getFontSize, setFontSize, type FontSize } from '@/lib/font-size';
import { apiClient } from '@/lib/guma';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from '@/types/preference';

const fontSizePreviewClass: Record<FontSize, string> = {
  default: 'text-sm',
  large: 'text-base',
  'x-large': 'text-lg',
};

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type NotificationStatus = 'loading' | 'ready' | 'error';

const NOTIFICATION_ITEMS: ReadonlyArray<{
  key: NotificationPreferenceKey;
  label: 'emailLabel' | 'auctionLabel' | 'lotteryLabel' | 'eventsLabel' | 'rollCallLabel';
  description: 'emailDesc' | 'auctionDesc' | 'lotteryDesc' | 'eventsDesc' | 'rollCallDesc';
  icon: string;
}> = [
  { key: 'emailNotifications', label: 'emailLabel', description: 'emailDesc', icon: 'solar:letter-linear' },
  { key: 'auctionAlerts', label: 'auctionLabel', description: 'auctionDesc', icon: 'solar:dollar-linear' },
  { key: 'lotteryAlerts', label: 'lotteryLabel', description: 'lotteryDesc', icon: 'solar:ticket-linear' },
  { key: 'eventReminders', label: 'eventsLabel', description: 'eventsDesc', icon: 'solar:calendar-linear' },
  { key: 'rollCallReminders', label: 'rollCallLabel', description: 'rollCallDesc', icon: 'solar:clipboard-list-linear' },
];

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
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [notificationStatus, setNotificationStatus] = React.useState<NotificationStatus>('loading');
  const [notificationSaveError, setNotificationSaveError] = React.useState('');
  const [notificationReload, setNotificationReload] = React.useState(0);
  const confirmedPrefsRef = React.useRef<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const saveRequestRef = React.useRef<Partial<Record<NotificationPreferenceKey, number>>>({});
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

  React.useEffect(() => {
    let active = true;
    apiClient
      .getMyPreferences()
      .then(prefs => {
        if (!active) return;
        confirmedPrefsRef.current = prefs.notifications;
        setNotificationPrefs(prefs.notifications);
        setNotificationStatus('ready');
      })
      .catch(() => {
        if (active) setNotificationStatus('error');
      });
    return () => {
      active = false;
    };
  }, [notificationReload]);

  const retryNotificationPrefs = () => {
    setNotificationStatus('loading');
    setNotificationReload(count => count + 1);
  };

  const toggleNotification = async (key: NotificationPreferenceKey, value: boolean) => {
    const request = (saveRequestRef.current[key] ?? 0) + 1;
    saveRequestRef.current[key] = request;
    setNotificationSaveError('');
    setNotificationPrefs(current => ({ ...current, [key]: value }));
    try {
      const saved = await apiClient.updateNotificationPreferences({ [key]: value });
      if (request !== saveRequestRef.current[key]) return;
      confirmedPrefsRef.current = saved.notifications;
      setNotificationPrefs(current => ({ ...current, [key]: saved.notifications[key] }));
    } catch {
      if (request !== saveRequestRef.current[key]) return;
      const restored = confirmedPrefsRef.current[key];
      setNotificationPrefs(current => ({ ...current, [key]: restored }));
      setNotificationSaveError(t('notificationsSaveFailed'));
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      {/* Header */}
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Appearance */}
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 shrink-0">
            <Icon className="text-accent" icon="solar:palette-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('appearance')}</p>
            <p className="type-caption text-hint">{t('appearanceSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p id="theme-label" className="type-body text-foreground">{t('theme')}</p>
            <div role="group" aria-labelledby="theme-label" className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as const).map(themeKey => (
                <button
                  key={themeKey}
                  type="button"
                  aria-pressed={theme === themeKey}
                  onClick={() => setTheme(themeKey)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                    theme === themeKey
                      ? 'border-accent bg-accent/10 text-foreground'
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
                      ? 'border-accent bg-accent/10 text-foreground'
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
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
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
      <Card className="border border-transparent shadow-edge bg-surface">
        <Card.Header className="flex flex-row items-center gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon className="text-subtle" icon="solar:bell-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="type-subheading text-foreground">{t('notifications')}</p>
            <p className="type-caption text-hint">{t('notificationsSubtitle')}</p>
          </div>
        </Card.Header>
        <Card.Content
          className="pt-0 flex flex-col gap-1"
          aria-busy={notificationStatus === 'loading'}
        >
          {notificationStatus === 'error' && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger/10 px-3 py-2"
            >
              <p className="type-caption text-danger">{t('notificationsLoadFailed')}</p>
              <Button size="sm" variant="secondary" onPress={retryNotificationPrefs}>
                {t('notificationsRetry')}
              </Button>
            </div>
          )}
          {notificationSaveError && (
            <p role="alert" className="type-caption text-danger px-1 py-1">
              {notificationSaveError}
            </p>
          )}
          {NOTIFICATION_ITEMS.map((item, idx, arr) => {
            const labelId = `notification-${item.key}-label`;
            const descriptionId = `notification-${item.key}-description`;
            return (
              <React.Fragment key={item.key}>
                <Switch
                  aria-labelledby={labelId}
                  aria-describedby={descriptionId}
                  isSelected={notificationPrefs[item.key]}
                  isDisabled={notificationStatus !== 'ready'}
                  onChange={value => void toggleNotification(item.key, value)}
                  size="sm"
                  className="w-full"
                >
                  <Switch.Content className="w-full min-h-11 justify-between gap-3 py-3 font-normal">
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon icon={item.icon} width={16} className="text-hint shrink-0" />
                      <span className="min-w-0">
                        <span id={labelId} className="block type-body text-foreground">
                          {t(item.label)}
                        </span>
                        <span id={descriptionId} className="block type-caption text-hint">
                          {t(item.description)}
                        </span>
                      </span>
                    </span>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
                {idx < arr.length - 1 && <Separator />}
              </React.Fragment>
            );
          })}
        </Card.Content>
      </Card>
    </div>
  );
}
