'use client';
import { Button, Card, Spinner, Alert } from '@heroui/react';
import { Icon } from '@iconify/react';
import { isAxiosError } from 'axios';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import React from 'react';
import { kratos } from '@/lib/kratos';
import { safeReturnPath } from '@/lib/safe-return-path';
import { checkSession } from '@/lib/session';

const DEFAULT_RETURN = '/dashboard';

const DemoLogin =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? dynamic(() => import('@/components/demo/DemoLogin'), { ssr: false }) : null;

export default function LoginPage() {
  if (DemoLogin) return <DemoLogin />;

  return (
    <React.Suspense>
      <Login />
    </React.Suspense>
  );
}

function loginPath(returnUrl: string, flowId?: string) {
  const params = new URLSearchParams();
  if (flowId) params.set('flow', flowId);
  if (returnUrl !== DEFAULT_RETURN) params.set('return', returnUrl);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}

async function createFlow(returnUrl: string) {
  if (returnUrl === DEFAULT_RETURN) return kratos.createBrowserLoginFlow();
  try {
    return await kratos.createBrowserLoginFlow({ returnTo: new URL(returnUrl, window.location.origin).href });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 400) return kratos.createBrowserLoginFlow();
    throw error;
  }
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
  const returnUrl = safeReturnPath(searchParams.get('return'), DEFAULT_RETURN);

  const createLoginFlow = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoginFlowError(false);
      setIsCreatingFlow(true);
      try {
        if (await checkSession()) {
          if (!signal?.aborted) router.replace(returnUrl);
          return;
        }
        const { data } = await createFlow(returnUrl);
        if (!signal?.aborted) router.replace(loginPath(returnUrl, data.id));
      } catch (error) {
        if (!signal?.aborted) {
          console.error('Error creating login flow:', error);
          setLoginFlowError(true);
        }
      } finally {
        if (!signal?.aborted) setIsCreatingFlow(false);
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
          router.replace(loginPath(returnUrl));
        } else {
          console.error('Error fetching login flow:', error);
          setLoginFlowError(true);
        }
      });
    return () => controller.abort();
  }, [flow, returnUrl, router]);

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

  const isReady = Boolean(flow) && validatedFlow === flow;

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-transparent shadow-edge bg-surface py-6">
        <Card.Header className="flex flex-col items-center gap-2 px-2 pt-2 pb-0 text-center sm:px-4">
          <Image src="/assets/logo/sunbaby-96x96.png" alt="Guma" width={60} height={60} preload />
          <h1 className="type-title text-foreground pt-2 text-balance">{t('title')}</h1>
          {isReady && <Card.Description className="type-prose text-subtle">{t('welcomeBack')}</Card.Description>}
        </Card.Header>
        <Card.Content className="flex flex-col gap-4 px-2 pt-4 pb-0 sm:px-4">
          {!isReady && loginFlowError ? (
            <>
              <Alert status="danger" role="alert">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>{t('loginUnavailable')}</Alert.Title>
                  <Alert.Description>{t('loginUnavailableDescription')}</Alert.Description>
                </Alert.Content>
              </Alert>
              <Button
                fullWidth
                className="h-12"
                isPending={isCreatingFlow}
                variant="primary"
                onPress={() => void createLoginFlow()}
              >
                {t('retry')}
              </Button>
            </>
          ) : !isReady ? (
            <div role="status" className="flex flex-col items-center justify-center py-6 gap-4">
              <Spinner size="lg" />
              <p className="type-body text-subtle">{t('preparing')}</p>
            </div>
          ) : (
            <>
              {(discordError || flowHasError) && (
                <Alert status="danger" role="alert">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>{t('discordLoginFailed')}</Alert.Title>
                    <Alert.Description>{t('discordLoginFailedDescription')}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}
              <Button
                variant="primary"
                className="w-full h-12"
                isPending={isRedirecting}
                onPress={loginWithDiscord}
              >
                {({ isPending }) => (
                  <>
                    {isPending ? (
                      <Spinner color="current" size="sm" />
                    ) : (
                      <Icon icon="ic:baseline-discord" width={22} />
                    )}
                    {t('loginWithDiscord')}
                  </>
                )}
              </Button>
            </>
          )}
        </Card.Content>
      </Card>
    </main>
  );
}
