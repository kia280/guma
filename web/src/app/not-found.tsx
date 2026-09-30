'use client';

import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const router = useRouter();
  const t = useTranslations('errorPage');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-transparent shadow-edge bg-surface">
        <Card.Header className="flex flex-col items-center gap-2">
          <div className="p-4 rounded-full">
            <Icon icon="solar:map-line-duotone" width={48} height={48} className="text-warning" />
          </div>
          <h1 className="type-display">404</h1>
        </Card.Header>

        <Card.Content className="gap-6 py-8">
          <div className="text-center space-y-2">
            <h2 className="type-heading">{t('err404Title')}</h2>
            <p className="text-subtle">{t('err404Desc')}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Button className="w-full" variant="primary" size="lg" onPress={() => router.push('/dashboard')}>
              <Icon icon="solar:home-line-duotone" />
              {t('goHome')}
            </Button>
            <Button className="w-full" variant="secondary" size="lg" onPress={() => router.back()}>
              <Icon icon="solar:arrow-left-line-duotone" />
              {t('goBack')}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
