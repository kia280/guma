'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Button, Input, Textarea, Select, SelectItem } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

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
      iconColor: 'text-[#5865F2]',
      bgColor: 'bg-[#5865F2]/10',
      label: t('discordLabel'),
      description: t('discordDesc'),
      action: t('discordAction'),
      href: 'https://discord.gg/',
    },
    {
      icon: 'solar:letter-bold-duotone',
      iconColor: 'text-primary',
      bgColor: 'bg-primary/10',
      label: t('emailLabel'),
      description: t('emailDesc'),
      action: t('emailAction'),
      href: 'mailto:support@guma.app',
    },
  ];

  const handleSubmit = () => {
    setSubmitted(true);
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-default-500 mt-0.5">{t('subtitle')}</p>
      </div>

      {/* Contact channels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {contactChannels.map(channel => (
          <Card key={channel.label} className="border border-divider shadow-none bg-content1">
            <CardBody className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${channel.bgColor} shrink-0`}
                >
                  <Icon className={channel.iconColor} icon={channel.icon} width={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{channel.label}</p>
                  <p className="text-xs text-default-400">{channel.description}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={() => window.open(channel.href, '_blank')}
                endContent={<Icon icon="solar:arrow-right-up-linear" width={14} />}
              >
                {channel.action}
              </Button>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Contact form */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardHeader className="flex gap-3 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-default-100 shrink-0">
            <Icon className="text-default-500" icon="solar:chat-round-dots-bold-duotone" width={20} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm font-medium text-foreground">{t('sendMessageTitle')}</p>
            <p className="text-xs text-default-400">{t('sendMessageDesc')}</p>
          </div>
        </CardHeader>
        <CardBody className="pt-0">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <Icon icon="solar:check-circle-bold" width={28} className="text-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t('messageSent')}</p>
                <p className="text-xs text-default-400 mt-0.5">{t('messageSentDesc')}</p>
              </div>
              <Button size="sm" variant="flat" onPress={() => setSubmitted(false)}>
                {t('sendAnother')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('name')}
                  placeholder={t('namePlaceholder')}
                  variant="bordered"
                  value={name}
                  onValueChange={setName}
                />
                <Input
                  label={t('email')}
                  placeholder={t('emailPlaceholder')}
                  type="email"
                  variant="bordered"
                  value={email}
                  onValueChange={setEmail}
                />
              </div>
              <Select label={t('topic')} placeholder={t('topicPlaceholder')} variant="bordered">
                {topics.map(topic => (
                  <SelectItem key={topic.key}>{topic.label}</SelectItem>
                ))}
              </Select>
              <Textarea
                label={t('message')}
                placeholder={t('messagePlaceholder')}
                variant="bordered"
                minRows={4}
                value={message}
                onValueChange={setMessage}
              />
              <div className="flex justify-end">
                <Button
                  color="primary"
                  onPress={handleSubmit}
                  isDisabled={!name || !email || !message}
                  startContent={<Icon icon="solar:letter-linear" width={16} />}
                >
                  {t('sendMessage')}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
