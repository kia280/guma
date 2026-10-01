import type {Metadata, Viewport} from "next";
import dynamic from "next/dynamic";
import {Noto_Sans_TC} from "next/font/google";
import Script from "next/script";
import {NextIntlClientProvider} from 'next-intl';
import {getLocale} from 'next-intl/server';
import {BrowserTimeZoneProvider} from "@/i18n/BrowserTimeZoneProvider";
import {HTML_LANG, isLocale, DEFAULT_LOCALE} from "@/i18n/locales";
import {withBasePath} from "@/lib/base-path";
import {paletteInitScript} from "@/lib/dev-palette";
import {env} from "@/lib/env";
import {fontSizeInitScript} from "@/lib/font-size";
import {Providers} from "./providers";
import "./globals.css";

const DemoLocaleProvider =
  process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? dynamic(() => import('@/components/demo/DemoLocaleProvider')) : null;

const font = Noto_Sans_TC({
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Guma - Guild Management System",
  description: "Modern guild management system for MMO games",
  manifest: withBasePath("/manifest.json"),
};

export const generateViewport = (): Viewport => ({
  width: "device-width",
  initialScale: 1,
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const content = (
    <BrowserTimeZoneProvider>
      <Providers>{children}</Providers>
    </BrowserTimeZoneProvider>
  );
  return (
    <html lang={HTML_LANG[isLocale(locale) ? locale : DEFAULT_LOCALE]} suppressHydrationWarning>
      <head>
        <Script id="font-size-init" strategy="beforeInteractive">
          {fontSizeInitScript}
        </Script>
        {env.devTools && <script dangerouslySetInnerHTML={{ __html: paletteInitScript }} />}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Guma" />
        <link rel="apple-touch-icon" href={withBasePath("/assets/logo/sunbaby-96x96.png")} />
      </head>
      <body className={font.className}>
        <NextIntlClientProvider>
          {DemoLocaleProvider ? <DemoLocaleProvider>{content}</DemoLocaleProvider> : content}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
