"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent, saveDisplayName } from "@/lib/storage";
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
  const [nameInput, setNameInput] = useState("");
  const [showNameOverlay, setShowNameOverlay] = useState(false);

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

  // Load existing displayName on mount, show overlay if no name
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = loadData().displayName;
    if (existing) {
      setNameInput(existing);
    } else {
      setShowNameOverlay(true);
    }
  }, []);

  const nameValid = nameInput.trim().length > 0;

  const handleStart = () => {
    if (!nameValid) return;
    saveDisplayName(nameInput.trim());
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

  // CSS 3D: main container + per-character bending
  const mainRef = useRef<HTMLDivElement>(null);
  const charsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const handleTilt = useCallback((x: number, y: number) => {
    const el = mainRef.current;
    if (!el) return;
    const moveX = x * 50;
    const moveY = y * 35;
    const rotY = x * 16;
    const rotX = -y * 10;
    el.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0) perspective(280px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;

    // Per-character bending — aggressive curve
    const chars = charsRef.current;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      const pos = (i / (chars.length - 1)) * 2 - 1;
      const charRotY = pos * x * 30;
      const charRotX = pos * -y * 14;
      const charZ = Math.abs(pos) * x * 25;
      ch.style.transform = `perspective(200px) rotateY(${charRotY.toFixed(1)}deg) rotateX(${charRotX.toFixed(1)}deg) translateZ(${charZ.toFixed(1)}px)`;
    }

    // Button — strong bend
    const btn = btnRef.current;
    if (btn) {
      const btnRotY = x * 14;
      const btnRotX = -y * 8;
      const btnSkew = x * 3;
      btn.style.transform = `perspective(300px) rotateX(${btnRotX.toFixed(1)}deg) rotateY(${btnRotY.toFixed(1)}deg) skewY(${btnSkew.toFixed(1)}deg)`;
    }
  }, []);

  return (
    <>
      {/* Canvas OUTSIDE main — stays fixed to viewport, unaffected by main's 3D transform */}
      <GyroBars className="fixed inset-0 z-0 pointer-events-none" onTilt={handleTilt} />

      <main ref={mainRef} className="relative flex-1 flex flex-col px-6" onClick={handleGyroPermission} style={{ transformOrigin: "center center", willChange: "transform" }}>

      {/* Top bar */}
      <header className="relative z-10 flex justify-between items-center pt-4">
        <a href="https://kosukumaofficialshop.pages.dev/" target="_blank" rel="noopener noreferrer"
           className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97]" style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px" }}>
          グッズ
        </a>
        <button
          onClick={() => router.push(`/${locale}/mypage`)}
          className="label-text text-[13px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97]"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
          }}
        >
          {t("landing.myPage")}
        </button>
      </header>

      {/* Hero — title + subtitle + CTA grouped tightly */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <h1
          className="animate-fade-in-up text-center text-foreground uppercase"
          style={{ fontSize: "clamp(3.2rem, 15vw, 6.5rem)", fontWeight: 400, lineHeight: 0.82, letterSpacing: "0.08em", textShadow: "0 0 40px rgba(0,250,154,0.15)", transformStyle: "preserve-3d" }}
        >
          {"THROW".split("").map((ch, i) => (
            <span key={`t${i}`} ref={el => { charsRef.current[i] = el; }} style={{ display: "inline-block", willChange: "transform" }}>{ch}</span>
          ))}
          <br />
          {"TO\u00A0WIN".split("").map((ch, i) => (
            <span key={`w${i}`} ref={el => { charsRef.current[5 + i] = el; }} style={{ display: "inline-block", willChange: "transform" }}>{ch}</span>
          ))}
        </h1>

        <p className="mt-5 text-[14px] tracking-[0.05em] text-foreground/50 text-center max-w-xs animate-fade-in-up delay-80" style={{ fontWeight: 500 }}>
          {t("landing.subtitle")}
        </p>

        {/* Show current name if set */}
        {nameValid && (
          <button
            onClick={() => setShowNameOverlay(true)}
            className="mt-6 text-[13px] text-accent/60 hover:text-accent transition-colors tracking-[0.08em] animate-fade-in-up delay-120"
          >
            {nameInput} ✏️
          </button>
        )}

        {/* CTA — tight to subtitle, not stuck at bottom */}
        {(!isDesktop || dismissedDesktop) && (
          <button
            ref={btnRef}
            onClick={handleStart}
            disabled={!nameValid}
            className={`mt-6 w-full max-w-[320px] text-black cta-text text-[17px] tracking-[0.15em] animate-fade-in-up delay-160 transition-all ${nameValid ? "bg-accent neon-glow" : "bg-accent/30 cursor-not-allowed"}`}
            style={{
              borderRadius: "16px",
              height: "62px",
              fontWeight: 700,
              willChange: "transform",
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
              <span className="text-[12px] text-accent tracking-widest uppercase">PB</span>
            </div>
            <button
              onClick={() => router.push(`/${locale}/ranking`)}
              className="mt-2 text-foreground/40 text-[13px] tracking-[0.1em] hover:text-foreground/60 transition-colors"
            >
              {t("ranking.viewRanking")} →
            </button>

            {/* Streak + Today's Best */}
            {(stats.streakDays > 1 || stats.todayBest > 0) && (
              <div className="flex items-center gap-4 mt-2">
                {stats.streakDays > 1 && (
                  <span className="text-foreground/35 text-[12px] tracking-[0.05em]">
                    🔥 {stats.streakDays} {t("landing.streakDays")}
                  </span>
                )}
                {stats.todayBest > 0 && (
                  <span className="text-foreground/35 text-[12px] tracking-[0.05em]">
                    {t("landing.todaysBest")}: {formatHeight(stats.todayBest)}m
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Merch link */}
      <div className="mt-auto pt-6 flex justify-center">
        <a href="https://kosukumaofficialshop.pages.dev/" target="_blank" rel="noopener noreferrer"
           className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97]"
           style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px" }}>
          グッズ
        </a>
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

      {/* Name overlay */}
      {showNameOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ backgroundColor: "rgba(5, 5, 8, 0.95)" }}>
          <div className="flex flex-col items-center text-center max-w-sm w-full animate-fade-in-up">
            <h2 className="text-[22px] font-semibold text-foreground mb-2 tracking-wide">
              ニックネームを入力
            </h2>
            <p className="text-[13px] text-foreground/40 mb-8">
              ランキングに表示される名前です
            </p>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder={t("landing.namePlaceholder")}
              maxLength={20}
              autoFocus
              className="w-full px-5 py-4 bg-white/8 border-2 border-accent/30 rounded-2xl text-foreground text-center text-[20px] font-semibold placeholder:text-white/30 focus:outline-none focus:border-accent/60 focus:bg-white/10 transition-all mb-6"
            />
            <button
              onClick={() => { if (nameInput.trim()) { saveDisplayName(nameInput.trim()); setShowNameOverlay(false); } }}
              disabled={!nameInput.trim()}
              className={`w-full py-4 rounded-2xl text-[16px] font-bold tracking-[0.1em] transition-all ${nameInput.trim() ? "bg-accent text-black neon-glow" : "bg-accent/20 text-foreground/30 cursor-not-allowed"}`}
            >
              OK
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
