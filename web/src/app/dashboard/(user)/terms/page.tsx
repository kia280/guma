'use client';

import { Card, CardBody } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useTranslations } from 'next-intl';

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
    <div className="flex flex-col gap-5 w-full max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm text-default-500 mt-0.5">{t('lastUpdated')}</p>
      </div>

      {/* Intro banner */}
      <Card className="border border-primary/20 shadow-none bg-primary/5">
        <CardBody className="flex flex-row items-start gap-3 py-4">
          <Icon icon="solar:info-circle-bold" width={18} className="text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-default-600">{t('bannerText')}</p>
        </CardBody>
      </Card>

      {/* Sections */}
      <Card className="border border-divider shadow-none bg-content1">
        <CardBody className="flex flex-col gap-5 p-6">
          {sections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
              <p className="text-sm text-default-500 leading-relaxed">{section.content}</p>
              {idx < sections.length - 1 && <div className="border-b border-divider mt-3" />}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
