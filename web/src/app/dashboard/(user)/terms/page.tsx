'use client';

import { Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/PageHeader';

export default function TermsPage() {
  const t = useTranslations('termsPage');

  const sections = [
    { title: t('section1Title'), content: t('section1Content') },
    { title: t('section2Title'), content: t('section2Content') },
    { title: t('section3Title'), content: t('section3Content') },
    { title: t('section4Title'), content: t('section4Content') },
    { title: t('section5Title'), content: t('section5Content') },
    { title: t('section6Title'), content: t('section6Content') },
    { title: t('section7Title'), content: t('section7Content') },
    { title: t('section8Title'), content: t('section8Content') },
    { title: t('section9Title'), content: t('section9Content') },
    { title: t('section10Title'), content: t('section10Content') },
  ];

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      {/* Header */}
      <PageHeader title={t('title')} description={t('lastUpdated')} />

      {/* Intro banner */}
      <Card className="border border-primary/20 shadow-none bg-primary/5">
        <Card.Content className="flex flex-row items-start gap-3 py-4">
          <Icon icon="solar:info-circle-bold" width={18} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/60">{t('bannerText')}</p>
        </Card.Content>
      </Card>

      {/* Sections */}
      <Card className="border border-divider shadow-none bg-surface">
        <Card.Content className="flex flex-col gap-5 p-6">
          {sections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <h2 className="text-sm font-medium text-foreground">{section.title}</h2>
              <p className="text-sm text-foreground/50 leading-relaxed">{section.content}</p>
              {idx < sections.length - 1 && <div className="border-b border-divider mt-3" />}
            </div>
          ))}
        </Card.Content>
      </Card>
    </div>
  );
}
