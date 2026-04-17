"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent } from "@/lib/storage";
import { formatHeight } from "@/lib/physics";
import { getTierForHeight } from "@/lib/tiers";
import { ConsentModal } from "@/components/consent-modal";

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [showConsent, setShowConsent] = useState(false);
  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0, todayDateISO: "", todayBest: 0, streakDays: 0, lastActiveDateISO: "" };
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

  const tier = getTierForHeight(stats.personalBest);

  return (
    <main className="relative flex-1 flex flex-col px-6 overflow-y-auto">
      {/* Top bar */}
      <header className="relative z-10 flex justify-end items-center pt-4">
        <button
          onClick={() => router.push(`/${locale}/mypage`)}
          className="label-text text-[12px] text-muted hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97]"
          style={{
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "8px",
          }}
        >
          {t("landing.myPage")}
        </button>
      </header>

      {/* Hero — title + subtitle + CTA grouped tightly */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center">
        <h1
          className="animate-fade-in-up text-center leading-[0.82] tracking-[0.08em] uppercase text-foreground font-normal"
          style={{ fontSize: "clamp(3.2rem, 15vw, 6.5rem)", textShadow: "0 0 40px rgba(0,250,154,0.15)" }}
        >
          THROW
          <br />
          TO WIN
        </h1>

        <p className="mt-5 text-[13px] tracking-[0.25em] uppercase text-muted text-center max-w-xs animate-fade-in-up delay-80">
          {t("landing.subtitle")}
        </p>

        {/* CTA — tight to subtitle, not stuck at bottom */}
        <button
          onClick={handleStart}
          className="mt-10 w-full max-w-[320px] bg-accent text-black cta-text text-[15px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-100 animate-fade-in-up delay-160 neon-glow"
          style={{
            borderRadius: "16px",
            height: "58px",
          }}
        >
          {t("landing.start")}
        </button>

        {/* PB + tier for returning users */}
        {stats.personalBest > 0 && (
          <div className="mt-6 flex flex-col items-center animate-fade-in-up delay-240">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: tier.color }}
              />
              <span className="height-number text-[22px] text-foreground/80">
                {formatHeight(stats.personalBest)}
                <span className="text-[13px] text-muted/60 ml-0.5">m</span>
              </span>
              <span className="text-[12px] text-muted/60 tracking-widest uppercase">PB</span>
            </div>
            <button
              onClick={() => router.push(`/${locale}/ranking`)}
              className="mt-2 text-muted/70 text-[12px] tracking-[0.1em] hover:text-foreground/60 transition-colors"
            >
              {t("ranking.viewRanking")} →
            </button>

            {/* Streak + Today's Best */}
            {(stats.streakDays > 1 || stats.todayBest > 0) && (
              <div className="flex items-center gap-4 mt-2">
                {stats.streakDays > 1 && (
                  <span className="text-muted text-[11px] tracking-[0.05em]">
                    🔥 {stats.streakDays} {t("landing.streakDays")}
                  </span>
                )}
                {stats.todayBest > 0 && (
                  <span className="text-muted text-[11px] tracking-[0.05em]">
                    {t("landing.todaysBest")}: {formatHeight(stats.todayBest)}m
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom spacer for safe area */}
      <div className="safe-bottom" />

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
