'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Switch, Select, SelectItem, Divider } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';

const languages = [
  { key: 'en', label: 'English' },
  { key: 'zht', label: '繁體中文' },
];

export default function PreferencePage() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('preferencePage');
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

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-default-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Appearance */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <Icon className="text-primary" icon="solar:palette-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('appearance')}</p>
            <p className="text-xs text-default-400">{t('appearanceSubtitle')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map(themeKey => (
              <button
                key={themeKey}
                onClick={() => setTheme(themeKey)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                  theme === themeKey
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-divider bg-content2 text-default-500 hover:border-default-400'
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
                <span className="text-xs font-medium capitalize">{themeLabels[themeKey]}</span>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Language */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:global-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('language')}</p>
            <p className="text-xs text-default-400">{t('languageSubtitle')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          <Select
            label={t('displayLanguage')}
            defaultSelectedKeys={['en']}
            variant="bordered"
            className="max-w-xs"
          >
            {languages.map(lang => (
              <SelectItem key={lang.key}>{lang.label}</SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {/* Notifications */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:bell-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('notifications')}</p>
            <p className="text-xs text-default-400">{t('notificationsSubtitle')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0 flex flex-col gap-1">
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
                  <Icon icon={item.icon} width={16} className="text-default-400 shrink-0" />
                  <div>
                    <p className="text-sm text-foreground">{item.label}</p>
                    <p className="text-xs text-default-400">{item.description}</p>
                  </div>
                </div>
                <Switch
                  isSelected={item.value}
                  onValueChange={item.onChange}
                  size="sm"
                  color="primary"
                />
              </div>
              {idx < arr.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
