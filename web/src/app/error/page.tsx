'use client';

import { Button, Card } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { safeReturnPath } from '@/lib/safe-return-path';

function ErrorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('errorPage');

  const ERROR_MESSAGES: Record<string, { title: string; description: string; statusCode: number }> =
    {
      '401': { title: t('err401Title'), description: t('err401Desc'), statusCode: 401 },
      '403': { title: t('err403Title'), description: t('err403Desc'), statusCode: 403 },
      '404': { title: t('err404Title'), description: t('err404Desc'), statusCode: 404 },
      '429': { title: t('err429Title'), description: t('err429Desc'), statusCode: 429 },
      '500': { title: t('err500Title'), description: t('err500Desc'), statusCode: 500 },
      '503': { title: t('err503Title'), description: t('err503Desc'), statusCode: 503 },
      session_inactive: {
        title: t('errSessionInactiveTitle'),
        description: t('errSessionInactiveDesc'),
        statusCode: 401,
      },
      invalid_session: {
        title: t('errInvalidSessionTitle'),
        description: t('errInvalidSessionDesc'),
        statusCode: 401,
      },
    };

  const errorId = searchParams.get('id') ?? '';
  const returnParam = searchParams.get('return');
  const returnUrl = safeReturnPath(returnParam);
  const hasReturnUrl = safeReturnPath(returnParam, '') !== '';

  const knownError = Object.hasOwn(ERROR_MESSAGES, errorId) ? ERROR_MESSAGES[errorId] : undefined;
  const error = knownError ?? {
    title: t('unknownTitle'),
    description: t('description'),
    statusCode: undefined,
  };

  const isSessionError = error.statusCode === 401;
  const signInUrl = hasReturnUrl ? `/login?return=${encodeURIComponent(returnUrl)}` : '/login';
  const showBack = !isSessionError && hasReturnUrl;
  const homeVariant = isSessionError || showBack ? 'secondary' : 'primary';

  const getErrorIcon = (statusCode?: number) => {
    switch (statusCode) {
      case 401:
      case 403:
        return 'solar:lock-line-duotone';
      case 404:
        return 'solar:map-line-duotone';
      case 429:
        return 'solar:clock-circle-line-duotone';
      case 500:
      case 503:
        return 'solar:bug-line-duotone';
      default:
        return 'solar:info-circle-line-duotone';
    }
  };

  const getIconColorClass = (statusCode?: number) => {
    if (statusCode === undefined) return 'text-subtle';
    if (statusCode === 404) return 'text-warning';
    return 'text-danger';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-col items-center gap-2">
          <div className={`p-4 rounded-full`}>
            <Icon
              icon={getErrorIcon(error.statusCode)}
              width={48}
              height={48}
              className={getIconColorClass(error.statusCode)}
            />
          </div>
          {error.statusCode !== undefined && <h1 className="type-display">{error.statusCode}</h1>}
        </Card.Header>

        <Card.Content className="gap-6 py-8">
          <div className="text-center space-y-2">
            <h2 className="type-heading">{error.title}</h2>
            <p className="text-subtle">{error.description}</p>
          </div>

          {knownError && (
            <div className="bg-surface-secondary rounded-lg p-3">
              <p className="type-caption text-soft font-mono break-all">
                {t('errorIdLabel')}{' '}
                <span className="text-foreground/90 font-semibold">{errorId}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {isSessionError && (
              <Button
                className="w-full"
                variant="primary"
                size="lg"
                onPress={() => router.push(signInUrl)}
              >
                <Icon icon="solar:login-2-line-duotone" />
                {t('signIn')}
              </Button>
            )}
            {showBack && (
              <Button
                className="w-full"
                variant="primary"
                size="lg"
                onPress={() => router.push(returnUrl)}
              >
                <Icon icon="solar:arrow-left-line-duotone" />
                {t('goBack')}
              </Button>
            )}
            <Button
              className="w-full"
              variant={homeVariant}
              size="lg"
              onPress={() => router.push('/')}
            >
              <Icon icon="solar:home-line-duotone" />
              {t('goHome')}
            </Button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-surface-secondary rounded-lg p-3 border border-dashed border-divider">
              <p className="type-caption text-soft mb-1">
                <span className="font-semibold">{t('debugInfoLabel')}</span>
              </p>
              <p className="type-caption text-soft font-mono break-all">
                {t('returnUrlLabel')} {returnUrl}
              </p>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}

export default function ErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">{/* loading */}</div>
      }
    >
      <ErrorPageContent />
    </Suspense>
  );
}
