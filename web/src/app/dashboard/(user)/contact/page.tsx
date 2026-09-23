'use client';

import React from 'react';
import { Card, Button, Input, TextArea, Select, TextField, Label, ListBox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/PageHeader';

export default function ContactPage() {
  const t = useTranslations('contactPage');
  const [submitted, setSubmitted] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');

  const topics = [
    { key: 'general', label: t('topicGeneral') },
    { key: 'billing', label: t('topicBilling') },
    { key: 'bug', label: t('topicBug') },
    { key: 'feature', label: t('topicFeature') },
    { key: 'account', label: t('topicAccount') },
    { key: 'other', label: t('topicOther') },
  ];

  const contactChannels = [
    {
      icon: 'ic:baseline-discord',
      iconColor: 'text-accent',
      bgColor: 'bg-accent/10',
      label: t('discordLabel'),
      description: t('discordDesc'),
      action: t('discordAction'),
      href: 'https://discord.gg/',
      color: 'accent' as const,
    },
    {
      icon: 'solar:letter-bold-duotone',
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      label: t('emailLabel'),
      description: t('emailDesc'),
      action: t('emailAction'),
      href: 'mailto:support@guma.app',
      color: 'primary' as const,
    },
  ];

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      {/* Header */}
      <PageHeader title={t('title')} description={t('subtitle')} />

      {/* Contact channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contactChannels.map(channel => (
          <Card key={channel.label} className="border border-divider shadow-none bg-surface">
            <Card.Content className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${channel.bgColor} shrink-0`}
                >
                  <Icon className={channel.iconColor} icon={channel.icon} width={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{channel.label}</p>
                  <p className="text-xs text-foreground/40">{channel.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => window.open(channel.href, '_blank')}
              >
                {channel.action}
                <Icon icon="solar:arrow-right-up-linear" width={14} />
              </Button>
            </Card.Content>
          </Card>
        ))}
      </div>

      {/* Contact form */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Header className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default shrink-0">
            <Icon
              className="text-foreground/50"
              icon="solar:chat-round-dots-bold-duotone"
              width={20}
            />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('sendMessageTitle')}</p>
            <p className="text-xs text-foreground/40">{t('sendMessageDesc')}</p>
          </div>
        </Card.Header>
        <Card.Content className="pt-0">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <Icon icon="solar:check-circle-bold" width={28} className="text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('messageSent')}</p>
                <p className="text-xs text-foreground/40 mt-0.5">{t('messageSentDesc')}</p>
              </div>
              <Button size="sm" variant="tertiary" onPress={() => setSubmitted(false)}>
                {t('sendAnother')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TextField>
                  <Label>{t('name')}</Label>
                  <Input
                    placeholder={t('namePlaceholder')}
                    variant="secondary"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </TextField>
                <TextField>
                  <Label>{t('email')}</Label>
                  <Input
                    placeholder={t('emailPlaceholder')}
                    type="email"
                    variant="secondary"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </TextField>
              </div>
              <Select placeholder={t('topicPlaceholder')}>
                <Label>{t('topic')}</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {topics.map(topic => (
                      <ListBox.Item key={topic.key} id={topic.key} textValue={topic.label}>
                        {topic.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <TextField>
                <Label>{t('message')}</Label>
                <TextArea
                  placeholder={t('messagePlaceholder')}
                  variant="secondary"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </TextField>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  onPress={handleSubmit}
                  isDisabled={!name || !email || !message}
                >
                  <Icon icon="solar:letter-linear" width={16} />
                  {t('sendMessage')}
                </Button>
              </div>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
