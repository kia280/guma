'use client';
import {
  Button,
  Card,
  InputGroup,
  TextField,
  Label,
  Checkbox,
  Link,
  Separator,
  Form,
  Spinner,
  Alert,
  FieldError,
} from '@heroui/react';
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
  const [isVisible, setIsVisible] = React.useState(false);
  const [loginFlowError, setLoginFlowError] = React.useState(false);
  const [isCreatingFlow, setIsCreatingFlow] = React.useState(false);
  const [validatedFlow, setValidatedFlow] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showErrors, setShowErrors] = React.useState(false);
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
      .then(() => {
        if (controller.signal.aborted) return;
        hasRecreatedFlow.current = false;
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

  const toggleVisibility = () => setIsVisible(!isVisible);

  const emailError = !email.trim()
    ? t('emailRequired')
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? null
      : t('emailInvalid');
  const passwordError = password ? null : t('passwordRequired');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    if (emailError || passwordError) {
      const form = event.currentTarget;
      requestAnimationFrame(() => {
        form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      });
    }
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
          <Card.Description className="type-prose text-subtle">
            {t('welcomeBack')}
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3 flex-1 justify-center px-4 pb-0">
          <Form className="flex flex-col gap-3" validationBehavior="aria" onSubmit={handleSubmit}>
            <TextField
              isRequired
              className="w-full"
              isInvalid={showErrors && !!emailError}
              value={email}
              onChange={setEmail}
            >
              <Label className="type-body font-medium text-soft">
                {t('emailAddress')}
              </Label>
              <InputGroup variant="secondary" className="h-12">
                <InputGroup.Input
                  name="email"
                  placeholder="name@example.com"
                  type="email"
                  className="min-w-0"
                />
              </InputGroup>
              {showErrors && emailError && <FieldError>{emailError}</FieldError>}
            </TextField>
            <TextField
              isRequired
              className="w-full"
              isInvalid={showErrors && !!passwordError}
              value={password}
              onChange={setPassword}
            >
              <Label className="type-body font-medium text-soft">{t('password')}</Label>
              <InputGroup variant="secondary" className="h-12">
                <InputGroup.Input
                  name="password"
                  type={isVisible ? 'text' : 'password'}
                  className="min-w-0"
                />
                <InputGroup.Suffix className="pr-1.5">
                  <Button
                    isIconOnly
                    aria-label={isVisible ? t('hidePassword') : t('showPassword')}
                    size="sm"
                    variant="ghost"
                    onPress={toggleVisibility}
                  >
                    {isVisible ? (
                      <Icon className="text-subtle" icon="bi:eye-slash-fill" width={18} />
                    ) : (
                      <Icon className="text-subtle" icon="bi:eye-fill" width={18} />
                    )}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
              {showErrors && passwordError && <FieldError>{passwordError}</FieldError>}
            </TextField>
            <div className="flex w-full items-center justify-between px-1 py-2">
              <Checkbox name="remember">
                <Checkbox.Content>
                  <Checkbox.Control className="border border-muted in-data-[selected=true]:border-transparent">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="type-body font-medium text-soft">{t('rememberMe')}</Label>
                </Checkbox.Content>
              </Checkbox>
              <Link className="type-body font-medium text-hint" href="#">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button
              variant="primary"
              className="w-full font-semibold h-12"
              type="submit"
            >
              {t('logIn')}
            </Button>
          </Form>
          <div className="flex items-center gap-3 py-1">
            <Separator className="flex-1" />
            <p className="type-caption text-hint shrink-0">{t('or')}</p>
            <Separator className="flex-1" />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="tertiary"
              className="w-full h-12 text-soft"
              onPress={() => {
                if (flow) {
                  kratos
                    .updateLoginFlow({
                      flow: flow,
                      updateLoginFlowBody: {
                        method: 'oidc',
                        provider: 'discord',
                      },
                    })
                    .catch(error => {
                      if (error.response?.data?.redirect_browser_to) {
                        window.location.href = error.response.data.redirect_browser_to;
                      } else {
                        console.error('Login flow error:', error);
                      }
                    });
                }
              }}
            >
              <Icon icon="logos:discord-icon" width={24} />
              {t('loginWithDiscord')}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
