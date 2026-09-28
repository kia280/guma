'use client';
import { Button, Card, Spinner, Alert } from '@heroui/react';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { kratos } from '@/lib/kratos';
import { safeReturnPath } from '@/lib/safe-return-path';
import { checkSession } from '@/lib/session';

export default function LoginPage() {
  return (
    <React.Suspense>
      <Login />
    </React.Suspense>
  );
}

function Login() {
  const t = useTranslations('loginPage');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loginFlowError, setLoginFlowError] = React.useState(false);
  const [isCreatingFlow, setIsCreatingFlow] = React.useState(false);
  const [validatedFlow, setValidatedFlow] = React.useState<string | null>(null);
  const [flowHasError, setFlowHasError] = React.useState(false);
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const [discordError, setDiscordError] = React.useState(false);
  const hasRecreatedFlow = React.useRef(false);
  const flow = searchParams.get('flow');
  const returnUrl = safeReturnPath(searchParams.get('return'), '/dashboard');

  const createLoginFlow = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoginFlowError(false);
      setIsCreatingFlow(true);

      if (await checkSession()) {
        if (!signal?.aborted) router.replace(returnUrl);
        return;
      }

      try {
        const { data } = await kratos.createBrowserLoginFlow();
        if (!signal?.aborted) router.replace('/login?flow=' + data.id);
      } catch (error) {
        if (!signal?.aborted) {
          console.error('Error creating login flow:', error);
          setLoginFlowError(true);
          setIsCreatingFlow(false);
        }
      }
    },
    [returnUrl, router]
  );

  React.useEffect(() => {
    if (flow) return;

    const controller = new AbortController();
    void createLoginFlow(controller.signal);
    return () => controller.abort();
  }, [createLoginFlow, flow]);

  React.useEffect(() => {
    if (!flow) return;

    const controller = new AbortController();
    kratos
      .getLoginFlow({ id: flow }, { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        hasRecreatedFlow.current = false;
        setFlowHasError(data.ui.messages?.some(message => message.type === 'error') ?? false);
        setValidatedFlow(flow);
      })
      .catch(error => {
        if (controller.signal.aborted) return;
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if ((status === 403 || status === 404 || status === 410) && !hasRecreatedFlow.current) {
          hasRecreatedFlow.current = true;
          router.replace('/login');
        } else {
          console.error('Error fetching login flow:', error);
          setLoginFlowError(true);
        }
      });
    return () => controller.abort();
  }, [flow, router]);

  const loginWithDiscord = () => {
    if (!flow) return;
    setDiscordError(false);
    setIsRedirecting(true);
    kratos
      .updateLoginFlow({
        flow,
        updateLoginFlowBody: {
          method: 'oidc',
          provider: 'discord',
        },
      })
      .catch(error => {
        const redirectTo = isAxiosError(error)
          ? error.response?.data?.redirect_browser_to
          : undefined;
        if (redirectTo) {
          window.location.href = redirectTo;
        } else {
          console.error('Login flow error:', error);
          setDiscordError(true);
          setIsRedirecting(false);
        }
      });
  };

  if (!flow || validatedFlow !== flow) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="rounded-xl bg-surface flex w-full max-w-lg flex-col gap-4 px-8 pt-6 pb-10">
          {loginFlowError ? (
            <div className="flex flex-col gap-4 py-8">
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('loginUnavailable')}</Alert.Title>
                  <Alert.Description>{t('loginUnavailableDescription')}</Alert.Description>
                </Alert.Content>
              </Alert>
              <Button
                fullWidth
                isPending={isCreatingFlow}
                variant="primary"
                onPress={() => void createLoginFlow()}
              >
                {t('retry')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Spinner size="lg" />
              <p className="type-body text-subtle">{t('redirecting')}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border border-divider shadow-none bg-surface py-6">
        <Card.Header className="flex flex-col items-center gap-2 px-4 pt-2 pb-0">
          <Image src="/assets/logo/sunbaby-96x96.png" alt="Guma" width={60} height={60} preload />
          <h1 className="type-title text-foreground pt-2">{t('title')}</h1>
          <Card.Description className="type-prose text-subtle">{t('welcomeBack')}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4 px-4 pt-4 pb-0">
          {(discordError || flowHasError) && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{t('discordLoginFailed')}</Alert.Title>
                <Alert.Description>{t('discordLoginFailedDescription')}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <Button
            variant="tertiary"
            className="w-full h-12 text-soft"
            isPending={isRedirecting}
            onPress={loginWithDiscord}
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <Icon icon="logos:discord-icon" width={24} />
                )}
                {t('loginWithDiscord')}
              </>
            )}
          </Button>
        </Card.Content>
      </Card>
    </div>
  );
}
