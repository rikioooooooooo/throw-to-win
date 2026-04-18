"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent } from "@/lib/storage";
import { formatHeight } from "@/lib/physics";
import { getTierForHeight } from "@/lib/tiers";
import { TierIcon } from "@/components/tier-icon";
import { ConsentModal } from "@/components/consent-modal";
import { GyroBars } from "@/components/gyro-ball";

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [showConsent, setShowConsent] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dismissedDesktop, setDismissedDesktop] = useState(false);

  useEffect(() => {
    const isMobile = typeof navigator !== "undefined" && (
      navigator.maxTouchPoints > 0 ||
      "ontouchstart" in window
    );
    setIsDesktop(!isMobile);
  }, []);

  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0, totalHeightMeters: 0, todayDateISO: "", todayBest: 0, streakDays: 0, lastActiveDateISO: "" };
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

  // iOS gyroscope permission — request on first tap.
  // requestPermission() MUST be the absolute first API call in the handler.
  const gyroRequestedRef = useRef(false);
  const handleGyroPermission = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (DeviceMotionEvent as any).requestPermission !== "function") return;
    if (gyroRequestedRef.current) return;
    gyroRequestedRef.current = true;
    // Use DeviceMotionEvent (not Orientation) — iOS grants both together,
    // and we know this API works from the play page permission flow.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (DeviceMotionEvent as any).requestPermission().catch(() => {});
  }, []);

  // CSS 3D perspective: apply directly to <main> to avoid iOS overflow bug
  const mainRef = useRef<HTMLDivElement>(null);
  const handleTilt = useCallback((x: number, y: number) => {
    const el = mainRef.current;
    if (!el) return;
    // Use translate for guaranteed iOS compatibility + perspective for 3D feel
    const moveX = x * 15;
    const moveY = y * 10;
    const rotY = x * 3;
    const rotX = -y * 2;
    el.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0) perspective(600px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
  }, []);

  return (
    <>
      {/* Canvas OUTSIDE main — stays fixed to viewport, unaffected by main's 3D transform */}
      <GyroBars className="fixed inset-0 z-0 pointer-events-none" onTilt={handleTilt} />

      <main ref={mainRef} className="relative flex-1 flex flex-col px-6" onClick={handleGyroPermission} style={{ transformOrigin: "center center", willChange: "transform" }}>

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
      <div className="flex-1 flex flex-col items-center justify-center">
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
        {(!isDesktop || dismissedDesktop) && (
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
        )}

        {/* PB + tier for returning users */}
        {stats.personalBest > 0 && (
          <div className="mt-6 flex flex-col items-center animate-fade-in-up delay-240">
            <div className="flex items-center gap-2">
              <TierIcon tierId={tier.id} size={28} />
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

      {/* Desktop warning overlay */}
      {isDesktop && !dismissedDesktop && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
          style={{ backgroundColor: "rgba(5, 5, 8, 0.92)" }}
        >
          <div className="flex flex-col items-center text-center max-w-md">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#00fa9a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-6">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
            <h2
              className="text-[20px] font-semibold tracking-wide text-foreground mb-3"
            >
              {t("landing.desktopTitle")}
            </h2>
            <p className="text-[14px] text-muted leading-relaxed mb-8">
              {t("landing.desktopSubtext")}
            </p>
            <button
              onClick={() => setDismissedDesktop(true)}
              className="text-muted/50 text-[12px] tracking-[0.1em] hover:text-muted transition-colors"
            >
              {t("landing.continueAnyway")}
            </button>
          </div>
        </div>
      )}

      {/* Consent modal */}
      {showConsent && (
        <ConsentModal
          onAgree={handleConsent}
          onDisagree={() => setShowConsent(false)}
        />
      )}
    </main>
    </>
  );
}
