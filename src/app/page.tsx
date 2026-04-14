"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from "@/lib/types";

/** Detect browser locale and redirect to the appropriate locale path */
function detectLocale(): string {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const languages = navigator.languages ?? [navigator.language];

  for (const lang of languages) {
    // Exact match (e.g., "zh-CN")
    const exact = SUPPORTED_LOCALES.find((l) => l === lang);
    if (exact) return exact;

    // Base match (e.g., "ja" from "ja-JP")
    const base = lang.split("-")[0];
    const baseMatch = SUPPORTED_LOCALES.find((l) => l === base);
    if (baseMatch) return baseMatch;

    // Chinese variants
    if (base === "zh") {
      if (lang.includes("TW") || lang.includes("HK") || lang.includes("Hant")) return "zh-TW";
      return "zh-CN";
    }
  }

  return DEFAULT_LOCALE;
}

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const locale = detectLocale();
    router.replace(`/${locale}`);
  }, [router]);

  // Black screen during redirect (instant, no flash)
  return <div className="min-h-screen bg-black" />;
}
