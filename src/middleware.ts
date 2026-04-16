import createMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import type { SupportedLocale } from "./lib/types";
import { SUPPORTED_LOCALES } from "./lib/types";

const COUNTRY_TO_LOCALE: Record<string, SupportedLocale> = {
  JP: "ja",
  US: "en",
  GB: "en",
  AU: "en",
  CA: "en",
  NZ: "en",
  CN: "zh-CN",
  TW: "zh-TW",
  HK: "zh-TW",
  KR: "ko",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  FR: "fr",
  BE: "fr",
  CH: "fr",
  DE: "de",
  AT: "de",
  BR: "pt",
  PT: "pt",
  SA: "ar",
  AE: "ar",
  EG: "ar",
  RU: "ru",
  IN: "hi",
};

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const country = request.headers.get("cf-ipcountry");
  const hasLocaleCookie = request.cookies.has("NEXT_LOCALE");

  if (country && !hasLocaleCookie) {
    const geoLocale = COUNTRY_TO_LOCALE[country];
    if (geoLocale && SUPPORTED_LOCALES.includes(geoLocale)) {
      const response = intlMiddleware(request);
      response.cookies.set("NEXT_LOCALE", geoLocale, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
      });
      return response;
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
