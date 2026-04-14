"use client";

import { useEffect, useState } from "react";
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
  const [stats, setStats] = useState({
    personalBest: 0,
    totalThrows: 0,
    totalAirtimeSeconds: 0,
  });

  useEffect(() => {
    const data = loadData();
    setStats(data.stats);
  }, []);

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
    <main className="relative flex-1 flex flex-col justify-between min-h-screen px-6 overflow-hidden safe-bottom">
      {/* Atmospheric red glow orb */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[120vw] h-[120vw] bg-accent blur-[150px] rounded-full opacity-[0.06] mix-blend-screen" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex justify-between items-center pt-4">
        <div className="w-2 h-2 bg-accent rounded-full animate-pulse-red" />
        <button
          onClick={() => router.push(`/${locale}/mypage`)}
          className="font-display tracking-widest uppercase text-[10px] text-muted hover:text-white transition-colors border border-border bg-surface px-4 py-2 active:scale-[0.97]"
        >
          {t("landing.myPage")}
        </button>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center animate-fade-in-up">
        <h1
          className="font-display font-black text-center leading-[0.8] tracking-tighter uppercase text-transparent bg-clip-text bg-gradient-to-b from-white to-muted"
          style={{ fontSize: "clamp(4rem, 18vw, 9rem)" }}
        >
          THROW
          <br />
          TO WIN
        </h1>

        <p className="mt-6 text-[12px] tracking-[0.3em] uppercase text-muted text-center max-w-xs animate-fade-in-up delay-100">
          {t("landing.subtitle")}
        </p>

        {/* Personal best */}
        {stats.personalBest > 0 && (
          <div className="mt-12 flex flex-col items-center animate-fade-in-up delay-200">
            <span className="text-[10px] tracking-[0.3em] text-muted/60 uppercase mb-2">
              {t("mypage.personalBest")}
            </span>
            <div className="flex items-baseline text-glow">
              <span className="font-display text-[56px] font-black text-accent hud-number leading-none tracking-tighter">
                {formatHeight(stats.personalBest)}
              </span>
              <span className="font-display text-[20px] text-accent-dark ml-1">m</span>
            </div>
          </div>
        )}

        {/* Secondary stats */}
        {stats.totalThrows > 0 && (
          <div className="flex gap-12 mt-8 animate-fade-in-up delay-300">
            <div className="text-center">
              <p className="text-[10px] text-muted/60 tracking-[0.3em] uppercase mb-1">
                {t("mypage.totalThrows")}
              </p>
              <p className="font-display text-[22px] font-black hud-number">
                {stats.totalThrows}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-muted/60 tracking-[0.3em] uppercase mb-1">
                {t("mypage.totalAirtime")}
              </p>
              <p className="font-display text-[22px] font-black hud-number">
                {stats.totalAirtimeSeconds.toFixed(1)}
                <span className="text-[14px] text-muted ml-0.5">s</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="relative z-10 pb-8 animate-fade-in-up delay-400">
        <button
          onClick={handleStart}
          className="w-full py-5 bg-accent text-white font-display text-[18px] font-black tracking-[0.3em] uppercase active:scale-[0.97] transition-transform duration-100 shadow-[0_0_40px_rgba(255,45,45,0.3)] relative overflow-hidden group"
        >
          <span className="relative z-10">{t("landing.start")}</span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-active:translate-y-0 transition-transform duration-200 ease-out" />
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
