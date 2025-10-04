"use client";
import React from "react";
import {Button, Input, Checkbox, Link, Divider, Form, Spinner} from "@heroui/react";
import {useTranslations} from 'next-intl';
import {Icon} from "@iconify/react";
import {useSearchParams, useRouter} from 'next/navigation';
import {kratos} from '@/lib/kratos';

export default function Login() {
  const t = useTranslations('loginPage');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isVisible, setIsVisible] = React.useState(false);
  const flow = searchParams.get('flow');

  React.useEffect(() => {
    if (!flow) {
      kratos.createBrowserLoginFlow({
        returnTo: window.location.origin + '/dashboard',
      }).then(({ data }) => {
        console.log(data);
        router.push(`/login?flow=${data.id}`);
      }).catch((error) => {
        if (error.response?.data?.id == 'session_already_available') {
          router.push('/dashboard');
          return;
        }
        console.error('Error creating login flow:', error);
      });
    }
  }, [flow, router]);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  if (!flow) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 p-2 sm:p-4 lg:p-8">
        <div className="rounded-large bg-content1 shadow-large flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Spinner size="lg" />
            <p className="text-default-500">Redirecting to login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-rose-400 via-fuchsia-500 to-indigo-500 p-2 sm:p-4 lg:p-8">
      <div className="rounded-large bg-content1 shadow-large flex w-full max-w-sm flex-col gap-4 px-8 pt-6 pb-10">
        <p className="pb-2 text-xl font-medium">{t("logIn")}</p>
        <Form className="flex flex-col gap-3" validationBehavior="native" onSubmit={handleSubmit}>
          <Input
            isRequired
            isDisabled
            label={t("emailAddress")}
            name="email"
            placeholder={t("enterYourEmail")}
            type="email"
            variant="bordered"
          />
          <Input
            isRequired
            isDisabled
            endContent={
              <button type="button" onClick={toggleVisibility}>
                {isVisible ? (
                  <Icon
                    className="text-default-400 pointer-events-none text-2xl"
                    icon="bi:eye-slash-fill"
                  />
                ) : (
                  <Icon
                    className="text-default-400 pointer-events-none text-2xl"
                    icon="bi:eye-fill"
                  />
                )}
              </button>
            }
            label={t("password")}
            name="password"
            placeholder={t("enterYourPassword")}
            type={isVisible ? "text" : "password"}
            variant="bordered"
          />
          <div className="flex w-full items-center justify-between px-1 py-2">
            <Checkbox 
              isDisabled
              name="remember" size="sm"
            >
              {t("rememberMe")}
            </Checkbox>
            <Link 
              isDisabled
              className="text-default-500" href="#" size="sm"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Button 
            isDisabled
            className="w-full" color="primary" type="submit"
          >
            {t("logIn")}
          </Button>
        </Form>
        <div className="flex items-center gap-4 py-2">
          <Divider className="flex-1" />
          <p className="text-tiny text-default-500 shrink-0">{t("or")}</p>
          <Divider className="flex-1" />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            startContent={<Icon icon="logos:discord-icon" width={24} />}
            variant="bordered"
            onPress={() => {
              if (flow) {
                kratos.updateLoginFlow({
                  flow: flow,
                  updateLoginFlowBody: {
                    method: 'oidc',
                    provider: 'discord'
                  }
                }).then((response) => {
                  console.log('Login flow updated:', response);
                }).catch((error) => {
                  if (error.response?.data?.redirect_browser_to) {
                    window.location.href = error.response.data.redirect_browser_to;
                  } else {
                    console.error('Login flow error:', error);
                  }
                });
              }
            }}
          >
            {t("loginWithDiscord")}
          </Button>
        </div>
        {/* <p className="text-small text-center">
          {t("DontHaveAccount")}&nbsp;
          <Link href="#" size="sm">
            {t("Register")}
          </Link>
        </p> */}
      </div>
    </div>
  )
}
