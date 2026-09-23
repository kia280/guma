import type {Metadata, Viewport} from "next";
import {Noto_Sans_TC} from "next/font/google";
import {NextIntlClientProvider} from 'next-intl';
import {Providers} from "./providers";
import Script from "next/script";
import {fontSizeInitScript} from "@/lib/font-size";
import "./globals.css";

const font = Noto_Sans_TC({
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Guma - Guild Management System",
  description: "Modern guild management system for MMO games",
  manifest: "/manifest.json",
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
  return (
    <html suppressHydrationWarning>
      <head>
        <Script id="font-size-init" strategy="beforeInteractive">
          {fontSizeInitScript}
        </Script>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Guma" />
        <link rel="apple-touch-icon" href="/assets/logo/sunbaby-96x96.png" />
      </head>
      <body className={font.className}>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
