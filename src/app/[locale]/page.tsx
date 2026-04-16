"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent } from "@/lib/storage";
import { formatHeight } from "@/lib/physics";
import { ConsentModal } from "@/components/consent-modal";

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [showConsent, setShowConsent] = useState(false);
  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0 };
    return loadData().stats;
  });

  const handleStart = () => {
    if (!hasValidConsent()) {
      setShowConsent(true);
      return;
    }
    router.push(`/${locale}/play`);
  };

  const handleConsent = () => {
    saveConsent();
    setShowConsent(false);
    router.push(`/${locale}/play`);
  };

  return (
    <main className="relative flex-1 flex flex-col justify-between min-h-screen px-5 overflow-hidden safe-bottom">
      {/* Top bar */}
      <header className="relative z-10 flex justify-end items-center pt-4">
        <button
          onClick={() => router.push(`/${locale}/mypage`)}
          className="label-text text-[11px] text-muted hover:text-foreground transition-colors px-4 py-2 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
        >
          {t("landing.myPage")}
        </button>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <h1
          className="animate-fade-in-up text-center leading-[0.85] tracking-[0.1em] uppercase text-foreground font-normal"
          style={{ fontSize: "clamp(3rem, 14vw, 6rem)" }}
        >
          THROW
          <br />
          TO WIN
        </h1>

        <p className="mt-6 text-[12px] tracking-[0.2em] uppercase text-muted text-center max-w-xs animate-fade-in-up delay-80">
          {t("landing.subtitle")}
        </p>

        {/* Personal best */}
        {stats.personalBest > 0 && (
          <div className="mt-12 flex flex-col items-center animate-fade-in-up delay-160">
            <span className="label-text text-[10px] tracking-[0.2em] text-muted/60 mb-2">
              {t("mypage.personalBest")}
            </span>
            <div className="flex items-baseline">
              <span
                className="height-number text-[56px] leading-none"
                style={{ color: "var(--color-accent)" }}
              >
                {formatHeight(stats.personalBest)}
              </span>
              <span className="text-[20px] text-muted ml-1">m</span>
            </div>
          </div>
        )}

        {/* Secondary stats */}
        {stats.totalThrows > 0 && (
          <div className="flex gap-12 mt-8 animate-fade-in-up delay-240">
            <div className="text-center">
              <p className="label-text text-[10px] text-muted/60 tracking-[0.2em] mb-1">
                {t("mypage.totalThrows")}
              </p>
              <p className="height-number text-[22px] text-foreground">
                {stats.totalThrows}
              </p>
            </div>
            <div className="text-center">
              <p className="label-text text-[10px] text-muted/60 tracking-[0.2em] mb-1">
                {t("mypage.totalAirtime")}
              </p>
              <p className="height-number text-[22px] text-foreground">
                {stats.totalAirtimeSeconds.toFixed(1)}
                <span className="text-[14px] text-muted ml-0.5">s</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="relative z-10 pb-8 animate-fade-in-up delay-320">
        <button
          onClick={handleStart}
          className="w-full py-4 bg-accent text-white cta-text text-[16px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-100"
          style={{ borderRadius: "14px", height: "56px" }}
        >
          {t("landing.start")}
        </button>
      </div>

      {/* Consent modal */}
      {showConsent && (
        <ConsentModal
          onAgree={handleConsent}
          onDisagree={() => setShowConsent(false)}
        />
      )}
    </main>
  );
}
