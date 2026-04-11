'use client';
import React from 'react';
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
} from '@heroui/react';
import { useTranslations } from 'next-intl';
import { Icon } from '@iconify/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { kratos } from '@/lib/kratos';

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
  const flow = searchParams.get('flow');

  React.useEffect(() => {
    if (!flow) {
      kratos
        .createBrowserLoginFlow({
          returnTo: window.location.origin + '/dashboard',
        })
        .then(({ data }) => {
          console.log(data);
          router.push(`/login?flow=${data.id}`);
        })
        .catch(error => {
          console.error('Error creating login flow:', error);
          if (error?.response?.data?.error?.id === 'session_already_available') {
            router.push('/dashboard');
            return;
          }
        });
    }
  }, [flow, router]);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  if (!flow) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <div className="rounded-xl bg-surface flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Spinner size="lg" />
            <p className="text-sm text-foreground/50">{t('redirecting')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg h-[600px] border border-divider shadow-none bg-surface">
        <Card.Header className="flex flex-col items-center gap-2 px-4 pt-2 pb-0">
          <img src="/assets/logo/sunbaby-96x96.png" alt="Guma" width={60} height={60} />
          <Card.Title className="text-2xl font-bold pt-2">{t('logIn')}</Card.Title>
          <Card.Description className="text-base font-medium text-foreground/50">
            {t('welcomeBack')}
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3 flex-1 justify-center px-4 pb-0">
          <Form className="flex flex-col gap-3" validationBehavior="native" onSubmit={handleSubmit}>
            <TextField isRequired className="w-full">
              <Label className="text-foreground/60 font-medium text-base">
                {t('emailAddress')}
              </Label>
              <InputGroup variant="secondary" className="h-12 text-base">
                <InputGroup.Input
                  name="email"
                  placeholder={t('enterYourEmail')}
                  type="email"
                  className="text-base"
                />
              </InputGroup>
            </TextField>
            <TextField isRequired className="w-full">
              <Label className="text-foreground/60 font-medium text-base">{t('password')}</Label>
              <InputGroup variant="secondary" className="h-12 text-base">
                <InputGroup.Input
                  name="password"
                  placeholder={t('enterYourPassword')}
                  type={isVisible ? 'text' : 'password'}
                  className="text-base"
                />
                <InputGroup.Suffix className="pr-0">
                  <Button
                    isIconOnly
                    aria-label={isVisible ? 'Hide password' : 'Show password'}
                    size="sm"
                    variant="ghost"
                    onPress={toggleVisibility}
                  >
                    {isVisible ? (
                      <Icon className="text-foreground/50 text-lg" icon="bi:eye-slash-fill" />
                    ) : (
                      <Icon className="text-foreground/50 text-lg" icon="bi:eye-fill" />
                    )}
                  </Button>
                </InputGroup.Suffix>
              </InputGroup>
            </TextField>
            <div className="flex w-full items-center justify-between px-1 py-2">
              <Checkbox id="remember">
                <Checkbox.Control className="bg-default">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Content>
                  <Label htmlFor="remember" className="text-base font-medium text-foreground/60">
                    {t('rememberMe')}
                  </Label>
                </Checkbox.Content>
              </Checkbox>
              <Link className="text-foreground/40 text-base font-medium" href="#">
                {t('forgotPassword')}
              </Link>
            </div>
            <Button variant="primary" className="w-full font-semibold h-12 text-base text-accent-foreground/90" type="submit">
              {t('logIn')}
            </Button>
          </Form>
          <div className="flex items-center gap-4 py-2">
            <Separator className="flex-1" />
            <p className="text-sm text-foreground/40 shrink-0">{t('or')}</p>
            <Separator className="flex-1" />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="tertiary"
              className="w-full h-12 text-base text-foreground/60"
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
                    .then(response => {
                      console.log('Login flow updated:', response);
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
