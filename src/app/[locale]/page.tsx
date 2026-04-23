"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent, saveDisplayName } from "@/lib/storage";
import { formatHeight } from "@/lib/physics";
import { getTierForHeight } from "@/lib/tiers";
import { TierIcon } from "@/components/tier-icon";
import { ConsentModal } from "@/components/consent-modal";
import { useRankings } from "@/hooks/use-rankings";
import { GyroBars } from "@/components/gyro-ball";
import { ThreadSheet } from "@/components/thread-sheet";
import { LandingThrowDetector } from "@/lib/landing-throw-detector";



export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [showConsent, setShowConsent] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [dismissedDesktop, setDismissedDesktop] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showNameOverlay, setShowNameOverlay] = useState(false);
  const [showGyroOverlay, setShowGyroOverlay] = useState(false);
  const [showThread, setShowThread] = useState(false);

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
  // For returning users on iOS: show gyro permission overlay directly
  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = loadData().displayName;
    if (existing) {
      setNameInput(existing);
      // Returning user — check if iOS gyro permission needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (DeviceMotionEvent as any).requestPermission === "function" && !gyroRequestedRef.current) {
        setShowGyroOverlay(true);
      }
    } else {
      setShowNameOverlay(true);
    }
  }, []);

  const nameValid = nameInput.trim().length > 0;
  const rankings = useRankings({ limit: 1, enabled: stats.personalBest > 0 });

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
  // Suppress gyro tilt while any overlay is showing
  const overlayActiveRef = useRef(false);
  overlayActiveRef.current = showNameOverlay || showGyroOverlay || showConsent || (isDesktop && !dismissedDesktop);

  const handleTilt = useCallback((x: number, y: number) => {
    if (overlayActiveRef.current) return;
    const el = mainRef.current;
    if (!el) return;
    const moveX = x * 70;
    const moveY = y * 50;
    const rotY = x * 24;
    const rotX = -y * 16;
    el.style.transform = `translate3d(${moveX.toFixed(1)}px, ${moveY.toFixed(1)}px, 0) perspective(220px) rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg)`;

    // Per-character bending — gentle unified curve (not scattered)
    const chars = charsRef.current;
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (!ch) continue;
      const pos = (i / (chars.length - 1)) * 2 - 1;
      const charRotY = pos * x * 12;
      const charRotX = pos * -y * 6;
      const charZ = Math.abs(pos) * x * 8;
      ch.style.transform = `perspective(400px) rotateY(${charRotY.toFixed(1)}deg) rotateX(${charRotX.toFixed(1)}deg) translateZ(${charZ.toFixed(1)}px)`;
    }

    // Button — strong bend
    const btn = btnRef.current;
    if (btn) {
      const btnRotY = x * 22;
      const btnRotX = -y * 14;
      const btnSkew = x * 5;
      btn.style.transform = `perspective(240px) rotateX(${btnRotX.toFixed(1)}deg) rotateY(${btnRotY.toFixed(1)}deg) skewY(${btnSkew.toFixed(1)}deg)`;
    }
  }, []);

  // ---- Manifesto: navigate to separate page ----
  const navigateToManifesto = useCallback(() => {
    router.push(`/${locale}/manifesto`);
  }, [router, locale]);

  // Logo 5-tap → navigate to manifesto
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleLogoTap = useCallback(() => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      navigateToManifesto();
      return;
    }
    logoTapTimer.current = setTimeout(() => {
      logoTapCount.current = 0;
    }, 1200);
  }, [navigateToManifesto]);

  // Throw detector — navigate to manifesto on throw-and-catch
  useEffect(() => {
    const detector = new LandingThrowDetector({
      onThrow: () => {
        navigateToManifesto();
      },
    });
    detector.start();
    return () => detector.stop();
  }, [navigateToManifesto]);

  return (
    <>
      {/* Canvas OUTSIDE main — stays fixed to viewport, unaffected by main's 3D transform */}
      <GyroBars className="fixed inset-0 z-0 pointer-events-none" onTilt={handleTilt} />

      <main ref={mainRef} className="relative flex-1 flex flex-col px-6 h-dvh overflow-hidden" style={{ transformOrigin: "center center" }}>

      {/* Top bar */}
      <header className="relative z-10 flex justify-between items-center pt-4">
        <a href="https://kosukuma-official-shop.pages.dev/" target="_blank" rel="noopener noreferrer"
           className="label-text text-[11px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 min-h-[44px] flex items-center active:scale-[0.97]">
          グッズ
        </a>
        <button
          onClick={() => router.push(`/${locale}/mypage`)}
          className="label-text text-[13px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 min-h-[44px] active:scale-[0.97] game-border"
        >
          {t("landing.myPage")}
        </button>
      </header>

      {/* Hero — game start screen layout */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Logo — BIG, hero-level, with green glow halo */}
        <div className="relative animate-fade-in-up" style={{ marginBottom: "clamp(8px, 2vw, 28px)" }}>
          {/* Green glow halo behind logo — no blur filter for perf */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(0, 226, 140, 0.08) 0%, rgba(0, 226, 140, 0.03) 30%, transparent 60%)",
              transform: "scale(1.7)",
            }}
            aria-hidden="true"
          />
          <img
            src="/assets/logo-landing.png"
            alt="Throw To Win"
            onClick={handleLogoTap}
            style={{
              width: "clamp(260px, 70vw, 420px)",
              height: "auto",
              position: "relative",
              zIndex: 1,
              cursor: "default",
              animation: "logo-hero-enter 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          />
        </div>

        <h1
          className="animate-fade-in-up text-center text-foreground uppercase"
          style={{ fontSize: "clamp(3.4rem, 16vw, 7rem)", fontWeight: 800, lineHeight: 0.82, letterSpacing: "0.1em", textShadow: "0 4px 20px rgba(0,0,0,0.3)", transformStyle: "preserve-3d" }}
        >
          {"THROW".split("").map((ch, i) => (
            <span key={`t${i}`} ref={el => { charsRef.current[i] = el; }} style={{ display: "inline-block" }}>{ch}</span>
          ))}
          <br />
          {"TO\u00A0WIN".split("").map((ch, i) => (
            <span key={`w${i}`} ref={el => { charsRef.current[5 + i] = el; }} style={{ display: "inline-block" }}>{ch}</span>
          ))}
        </h1>

        <p className="mt-4 text-[13px] tracking-[0.06em] text-foreground/45 text-center max-w-xs animate-fade-in-up delay-80" style={{ fontWeight: 400 }}>
          {t("landing.subtitle")}
        </p>

        {/* Show current name if no PB (name shows inside PB card when PB exists) */}
        {nameValid && stats.personalBest <= 0 && (
          <button
            onClick={() => setShowNameOverlay(true)}
            className="mt-5 text-[13px] text-accent/60 hover:text-accent transition-colors tracking-[0.05em] animate-fade-in-up delay-120 flex items-center gap-1"
          >
            {nameInput} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
          </button>
        )}

        {/* CTA — big, game-style, unmissable */}
        {(!isDesktop || dismissedDesktop) && (
          <button
            ref={btnRef}
            onClick={handleStart}
            disabled={!nameValid}
            className={`mt-6 w-full max-w-[300px] text-black cta-text text-[16px] tracking-[0.1em] animate-fade-in-up delay-160 transition-all ${nameValid ? "bg-accent neon-glow" : "bg-accent/30 cursor-not-allowed"}`}
            style={{
              borderRadius: "14px",
              height: "58px",
              textShadow: nameValid ? "0 1px 0 rgba(0,0,0,0.15)" : "none",
            }}
          >
            {t("landing.start")}
          </button>
        )}

        {/* PB + tier for returning users — tappable card → mypage */}
        {stats.personalBest > 0 && (
          <div className="mt-6 w-full max-w-[320px] animate-fade-in-up delay-240">
            <button
              onClick={() => router.push(`/${locale}/mypage`)}
              className="game-card p-4 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-transform"
            >
              <TierIcon tierId={tier.id} size={36} />
              <div className="flex-1 min-w-0">
                {nameValid && (
                  <div className="text-[12px] text-foreground/50 tracking-[0.05em] mb-1 truncate">
                    {nameInput}
                  </div>
                )}
                <div className="flex items-baseline gap-1.5">
                  <span className="height-number text-[26px] text-foreground">
                    {formatHeight(stats.personalBest)}
                  </span>
                  <span className="text-[13px] text-muted/60">m</span>
                  <span className="text-[11px] text-accent tracking-[0.2em] uppercase font-bold ml-1">PB</span>
                  {rankings.selfRank && (
                    <span className="text-[11px] text-foreground/30 tracking-[0.1em] ml-2">#{rankings.selfRank}</span>
                  )}
                </div>
                {(stats.streakDays > 1 || stats.todayBest > 0) && (
                  <div className="flex items-center gap-3 mt-1">
                    {stats.streakDays > 1 && (
                      <span className="text-foreground/30 text-[11px] tracking-[0.05em] flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg> {stats.streakDays} {t("landing.streakDays")}
                      </span>
                    )}
                    {stats.todayBest > 0 && (
                      <span className="text-foreground/30 text-[11px] tracking-[0.05em]">
                        {t("landing.todaysBest")}: {formatHeight(stats.todayBest)}m
                      </span>
                    )}
                  </div>
                )}
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent/50 shrink-0">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Thread button */}
      <button
        onClick={() => setShowThread(true)}
        className="mt-auto mb-4 w-full max-w-[180px] py-3 text-center text-foreground/60 text-[12px] tracking-[0.05em] hover:text-foreground active:scale-[0.97] transition-all game-border"
      >
        {t("thread.voices")}
      </button>

      {/* Bottom spacer for safe area */}
      <div className="safe-bottom" />


      <ThreadSheet open={showThread} onClose={() => setShowThread(false)} />

      {/* Desktop warning overlay */}
      {isDesktop && !dismissedDesktop && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
          style={{ backgroundColor: "rgba(5, 10, 8, 0.94)" }}
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
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ backgroundColor: "rgba(5, 10, 8, 0.96)" }}>
          <div className="flex flex-col items-center text-center max-w-sm w-full animate-fade-in-up">
            <h2 className="text-[22px] font-semibold text-foreground mb-2 tracking-wide">
              ニックネームを入力
            </h2>
            <p className="text-[13px] text-foreground/40 mb-8">
              ランキングに表示される名前です
            </p>
            <input
              type="text"
              name="ttw-name-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder={t("landing.namePlaceholder")}
              maxLength={20}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              className="w-full px-5 py-4 bg-white/8 border-2 border-accent/30 rounded-xl text-foreground text-center text-[20px] font-semibold placeholder:text-white/30 focus:outline-none focus:border-accent/60 focus:bg-white/10 transition-all mb-6"
            />
            <button
              onClick={() => {
                if (!nameInput.trim()) return;
                saveDisplayName(nameInput.trim());
                setShowNameOverlay(false);
                // Show gyro permission guide next (only on iOS)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (DeviceMotionEvent as any).requestPermission === "function" && !gyroRequestedRef.current) {
                  setShowGyroOverlay(true);
                }
              }}
              disabled={!nameInput.trim()}
              className={`w-full py-4 rounded-[10px] text-[16px] font-bold tracking-[0.1em] transition-all ${nameInput.trim() ? "bg-accent text-black neon-glow" : "bg-accent/20 text-foreground/30 cursor-not-allowed"}`}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Gyro permission overlay */}
      {showGyroOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8" style={{ backgroundColor: "rgba(5, 10, 8, 0.96)" }}>
          <div className="flex flex-col items-center text-center max-w-sm w-full animate-fade-in-up">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-foreground/60">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
            <h2 className="text-[20px] font-semibold text-foreground mb-2 tracking-wide">
              センサーとカメラを使います
            </h2>
            <p className="text-[13px] text-foreground/40 mb-3 leading-relaxed">
              スマホの傾き検知と
              <br />
              投擲中の撮影に使用します
            </p>
            <p className="text-[11px] text-foreground/25 mb-8">
              表示されるダイアログで「許可」を選んでください
            </p>
            <button
              onClick={async () => {
                // Request both motion + camera in one user gesture
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
                  gyroRequestedRef.current = true;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  await (DeviceMotionEvent as any).requestPermission().catch(() => {});
                }
                // Pre-request camera permission (stop stream immediately)
                try {
                  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
                  stream.getTracks().forEach(t => t.stop());
                } catch { /* user denied or no camera */ }
                setShowGyroOverlay(false);
              }}
              className="w-full py-4 rounded-[10px] text-[16px] font-bold tracking-[0.1em] bg-accent text-black neon-glow"
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
