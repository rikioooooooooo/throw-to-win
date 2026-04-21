import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Outfit } from "next/font/google";
import { routing } from "@/i18n/routing";
import { ErrorBoundary } from "@/components/error-boundary";
import { DataReset } from "@/components/data-reset";
import "../globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Throw To Win",
  description: "スマホを上空に高く投げた人が勝つゲーム",
  icons: {
    icon: [
      { url: "/favicon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Throw To Win",
    description: "スマホを上空に高く投げた人が勝つゲーム",
    siteName: "Throw To Win",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Throw To Win",
    description: "スマホを上空に高く投げた人が勝つゲーム",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050a08",
};

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`h-full ${outfit.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground safe-top">
        <NextIntlClientProvider messages={messages}>
          <DataReset />
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
