"use client";

import { Fragment, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData } from "@/lib/storage";
import { CountUpHeight } from "@/components/count-up-height";
import { SlowMoPlayer } from "@/components/slow-mo-player";
import { RankingList } from "@/components/ranking-list";
import { useRankings } from "@/hooks/use-rankings";
import { TierIcon } from "@/components/tier-icon";
import { ThreadSheet } from "@/components/thread-sheet";
import { CrackerParticles } from "@/components/cracker-particles";
import { determineAchievements } from "@/lib/achievements";
import type { HeightTier } from "@/components/height-display";
import type { VerifyResponse } from "@/lib/challenge";

type ResultData = {
  readonly height: number;
  readonly airtime: number;
  readonly isPersonalBest: boolean;
  readonly videoBlob: Blob | null;
  readonly peakOffset: number;
  readonly ffmpegProcessed: boolean;
  readonly samples: readonly { readonly t: number; readonly h: number }[];
  readonly previousBest: number;
};

type TierInfo = {
  readonly current: { readonly id: string; readonly color: string };
  readonly isBreakthrough: boolean;
  readonly nearMiss: {
    readonly type: "tier" | "pb";
    readonly remaining: number;
    readonly targetName: string;
  } | null;
};

type ResultScreenProps = {
  readonly resultData: ResultData;
  readonly rankingData: VerifyResponse | null;
  readonly videoUrl: string | null;
  readonly resultTier: HeightTier;
  readonly tierInfo: TierInfo | null;
  readonly onSaveVideo: () => void;
  readonly onShareVideo: () => void;
  readonly onTryAgain: () => void;
  readonly onGoHome: () => void;
  readonly submitError?: boolean;
};

export function ResultScreen({
  resultData,
  rankingData,
  videoUrl,
  resultTier,
  tierInfo,
  onSaveVideo,
  onShareVideo,
  onTryAgain,
  onGoHome,
  submitError,
}: ResultScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const rankings = useRankings({ limit: 10, enabled: !!rankingData });
  const [showThread, setShowThread] = useState(false);
  const [todayStats] = useState(() => {
    if (typeof window === "undefined") return { todayBest: 0, streakDays: 0 };
    const d = loadData();
    return { todayBest: d.stats.todayBest, streakDays: d.stats.streakDays };
  });

  const achievement = determineAchievements({
    worldRank: rankingData?.worldRank ?? null,
    countryRank: rankingData?.countryRank ?? null,
    isPersonalBest: resultData.isPersonalBest,
    tierId: tierInfo?.current.id ?? "rookie",
    isBreakthrough: tierInfo?.isBreakthrough ?? false,
  });

  const [crackerActive, setCrackerActive] = useState(false);
  useEffect(() => {
    if (achievement.crackerLevel === "none") return;
    const fireTimer = setTimeout(() => {
      setCrackerActive(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        if (achievement.crackerLevel === "legendary") navigator.vibrate([100, 50, 100, 50, 200]);
        else if (achievement.crackerLevel === "epic") navigator.vibrate([80, 40, 80]);
        else navigator.vibrate(50);
      }
    }, 200);
    // Force-stop crackers after 3.5s to ensure video interactivity on iOS Safari
    const stopTimer = setTimeout(() => {
      setCrackerActive(false);
    }, 3500);
    return () => {
      clearTimeout(fireTimer);
      clearTimeout(stopTimer);
    };
  }, [achievement.crackerLevel]);

  const tierColor =
    tierInfo?.isBreakthrough
      ? tierInfo.current.color
      : resultTier === "personal-best"
        ? "var(--color-accent)"
        : "var(--color-foreground)";

  // Compute rank-specific glow style for the height number and status text
  const rankGlow = (() => {
    const wr = achievement.isWorldRecord;
    const w5 = achievement.worldTop5Rank;
    const c5 = achievement.countryTop5Rank;

    // All glow is now driven by CSS classes so everything pulses in sync
    if (wr) return { heightClass: "rank-height-wr", textClass: "rank-glow-wr", badgeClass: "rank-badge-wr", cardClass: "rank-card-wr" };
    if (w5 === 2) return { heightClass: "rank-height-gold", textClass: "rank-glow-gold", badgeClass: "rank-badge-gold", cardClass: "rank-card-gold" };
    if (w5 === 3) return { heightClass: "rank-height-silver", textClass: "rank-glow-silver", badgeClass: "rank-badge-silver", cardClass: "rank-card-silver" };
    if (w5 === 4) return { heightClass: "rank-height-bronze", textClass: "rank-glow-bronze", badgeClass: "rank-badge-bronze", cardClass: "rank-card-bronze" };
    if (w5 === 5) return { heightClass: "rank-height-accent", textClass: "rank-glow-accent", badgeClass: "rank-badge-accent", cardClass: "rank-card-accent" };
    if (c5 === 1) return { heightClass: "rank-height-c1", textClass: "rank-glow-country1", badgeClass: "rank-badge-c1", cardClass: "rank-card-c1" };
    if (c5 === 2) return { heightClass: "rank-height-accent", textClass: "rank-glow-accent", badgeClass: "rank-badge-accent", cardClass: "rank-card-accent" };
    if (c5 === 3) return { heightClass: "rank-height-teal", textClass: "rank-glow-teal", badgeClass: "rank-badge-teal", cardClass: "rank-card-teal" };
    if (c5 === 4) return { heightClass: "", textClass: "", badgeClass: "", cardClass: "" };
    if (c5 === 5) return { heightClass: "", textClass: "", badgeClass: "", cardClass: "" };
    return { heightClass: "", textClass: "", badgeClass: "", cardClass: "" };
  })();

  return (
    <main className="fixed inset-0 z-10 flex flex-col bg-background safe-top safe-bottom">
      {/* Background effects — tier-colored for special, subtle for normal */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {(resultData.isPersonalBest || tierInfo?.isBreakthrough) ? (
          <>
            {/* Tier-colored ambient glow — large, dramatic */}
            <div
              className="absolute"
              style={{
                top: "10%",
                left: "50%",
                width: "120vw",
                height: "60vh",
                transform: "translateX(-50%)",
                background: `radial-gradient(ellipse at 50% 30%, ${tierInfo?.current.color ?? "var(--color-accent)"}18 0%, ${tierInfo?.current.color ?? "var(--color-accent)"}06 35%, transparent 65%)`,
                animation: "result-glow 3s ease-in-out infinite",
              }}
            />
            {/* Expanding rings — one-shot, staggered */}
            <div className="absolute inset-0 flex items-start justify-center" style={{ paddingTop: "18vh" }}>
              <div className="absolute rounded-full" style={{ width: 300, height: 300, border: `1.5px solid ${tierInfo?.current.color ?? "var(--color-accent)"}`, animation: "radial-burst 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both" }} />
              <div className="absolute rounded-full" style={{ width: 300, height: 300, border: `1px solid ${tierInfo?.current.color ?? "var(--color-accent)"}`, animation: "radial-burst 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both" }} />
              <div className="absolute rounded-full" style={{ width: 300, height: 300, border: `0.5px solid ${tierInfo?.current.color ?? "var(--color-accent)"}`, animation: "radial-burst 1.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s both" }} />
            </div>
            {/* Brief screen flash */}
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 20%, ${tierInfo?.current.color ?? "var(--color-accent)"}30, transparent 50%)`, animation: "pb-flash 0.6s ease-out both" }} />
          </>
        ) : (
          /* Normal throw — subtle green ambient only */
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(0, 250, 154, 0.06) 0%, transparent 50%)" }} />
        )}
      </div>

      <div className={`flex-1 flex flex-col items-center px-6 py-6 w-full max-w-md relative z-[60] overflow-y-auto mx-auto ${rankGlow.cardClass}`}>

        {/* ---- Height hero ---- */}
        <div className="text-center mt-2 mb-1 animate-fade-in-up relative">
          {/* Achievement celebration badge — priority: chuuniTier > WR > PB */}
          {achievement.badge === "chuuniTier" && tierInfo && (
            <div className="relative flex flex-col items-center mb-2">
              {rankGlow.badgeClass && <div className={`absolute rounded-full pointer-events-none ${rankGlow.badgeClass}`} style={{ width: 200, height: 200, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "radial-gradient(circle, var(--rank-bg-color, rgba(0,250,154,0.3)) 0%, transparent 70%)" }} aria-hidden="true" />}
              <div className="relative"><TierIcon tierId={tierInfo.current.id} size={72} /></div>
            </div>
          )}
          {achievement.badge === "worldRecord" && (
            <div className="relative flex flex-col items-center mb-2">
              {rankGlow.badgeClass && <div className={`absolute rounded-full pointer-events-none ${rankGlow.badgeClass}`} style={{ width: 200, height: 200, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "radial-gradient(circle, var(--rank-bg-color, rgba(0,250,154,0.3)) 0%, transparent 70%)" }} aria-hidden="true" />}
              <img
                src="/assets/final/achievement/wr-update.png"
                alt=""
                aria-hidden="true"
                className="relative"
                style={{
                  width: "128px",
                  height: "72px",
                  objectFit: "contain",
                  animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
                }}
              />
            </div>
          )}
          {achievement.badge === "personalBest" && (
            <div className="relative flex flex-col items-center mb-2">
              {rankGlow.badgeClass && <div className={`absolute rounded-full pointer-events-none ${rankGlow.badgeClass}`} style={{ width: 200, height: 200, top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "radial-gradient(circle, var(--rank-bg-color, rgba(0,250,154,0.3)) 0%, transparent 70%)" }} aria-hidden="true" />}
              <img
                src="/assets/final/achievement/pb-update.png"
                alt=""
                aria-hidden="true"
                className="relative"
                style={{
                  width: "128px",
                  height: "72px",
                  objectFit: "contain",
                  animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both",
                }}
              />
            </div>
          )}
          {(() => {
            const parts: string[] = [];
            if (achievement.isWorldRecord) parts.push(t("result.worldRecord"));
            if (achievement.worldTop5Rank !== null) parts.push(`\u{1F30D} #${achievement.worldTop5Rank}`);
            if (achievement.countryTop5Rank !== null) {
              parts.push(`🏳️ #${achievement.countryTop5Rank}`);
            }
            if (achievement.isChuuniTier && achievement.chuuniTierId) {
              parts.push(t("result.chuuniTierReached", { tier: t(`tier.${achievement.chuuniTierId}`) }));
            }
            if (achievement.isPersonalBest && !achievement.isWorldRecord && !achievement.isChuuniTier) {
              parts.push(t("result.newRecord"));
            }
            if (parts.length === 0) return null;
            return (
              <div
                className={`achievement-badge ${rankGlow.textClass}`}
                style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "12px", marginTop: "6px", width: "100%" }}
              >
                {parts.map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <span className="label-text" style={{ fontSize: "11px", color: "rgba(0, 250, 154, 0.3)", fontWeight: 300 }} aria-hidden="true">/</span>
                    )}
                    <span className="label-text flex items-center gap-1" style={{ fontSize: "12px", letterSpacing: "0.05em", color: "var(--color-accent)", whiteSpace: "nowrap" }}>
                      {part.includes("\u{1F30D}") ? (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg> {part.replace("\u{1F30D} ", "")}</>
                      ) : part.includes("🏳️") ? (
                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg> {part.replace("🏳️ ", "")}</>
                      ) : part}
                    </span>
                  </Fragment>
                ))}
              </div>
            );
          })()}

          {/* Celebration burst rings */}
          {(resultData.isPersonalBest || tierInfo?.isBreakthrough) && (
            <div className="relative w-full flex justify-center" style={{ height: 0 }} aria-hidden="true">
              <div
                className="absolute rounded-full pointer-events-none"
                style={{
                  width: 200,
                  height: 200,
                  top: -100,
                  left: "50%",
                  border: `2px solid ${tierInfo?.isBreakthrough ? tierInfo.current.color : "var(--color-accent)"}`,
                  animation: "radial-burst 1s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both",
                }}
              />
              {tierInfo?.isBreakthrough && (
                <div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    width: 200,
                    height: 200,
                    top: -100,
                    left: "50%",
                    border: `2px solid ${tierInfo.current.color}`,
                    animation: "radial-burst 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both",
                  }}
                />
              )}
            </div>
          )}

          <div className="flex items-baseline justify-center">
            <CountUpHeight
              target={resultData.height}
              samples={resultData.samples.length > 0 ? resultData.samples : undefined}
              className={`height-number leading-none ${rankGlow.heightClass}`}
              style={{
                color: tierColor,
                fontSize: "clamp(4.8rem, 26vw, 8.2rem)",
                ...(!rankGlow.heightClass ? { textShadow: resultData.isPersonalBest || tierInfo?.isBreakthrough ? "0 0 40px currentColor, 0 0 80px currentColor" : "0 0 30px currentColor" } : {}),
              }}
            />
            <span
              className="text-[22px] ml-0.5"
              style={{
                color: resultTier === "personal-best"
                  ? "rgba(0, 250, 154, 0.35)"
                  : "var(--color-muted)",
              }}
            >
              m
            </span>
          </div>

          {/* Tier badge — game-style pill */}
          {tierInfo && (
            <div
              className="mt-3 flex items-center justify-center gap-2"
              style={{ animation: "badge-appear 0.3s ease-out 0.3s both" }}
            >
              <TierIcon tierId={tierInfo.current.id} size={44} />
              <span
                className="text-[15px] font-bold tracking-[0.15em] uppercase"
                style={{ color: tierInfo.current.color }}
              >
                {t(`tier.${tierInfo.current.id}`)}
              </span>
              {tierInfo.isBreakthrough && (
                <span
                  className="achievement-badge text-[11px] font-bold tracking-wider"
                  style={{
                    color: tierInfo.current.color,
                    borderColor: tierInfo.current.color,
                    background: `${tierInfo.current.color}15`,
                    boxShadow: `0 0 16px ${tierInfo.current.color}30`,
                    padding: "3px 10px",
                  }}
                >
                  {t("tier.new")}
                </span>
              )}
            </div>
          )}
        </div>

        <p className="text-muted/60 text-[14px] tracking-[0.15em] mb-3 animate-fade-in-up delay-80">
          {resultData.airtime.toFixed(2)}
          <span className="text-[10px] ml-0.5">s</span>
        </p>

        {resultData.height >= todayStats.todayBest && todayStats.todayBest > 0 && (
          <p className="text-accent text-[12px] tracking-[0.1em] mb-3 animate-fade-in-up delay-160">
            {t("result.todaysBest")}
          </p>
        )}

        {submitError && !rankingData && (
          <p className="text-muted/60 text-[13px] tracking-widest mb-4">
            {t("result.scoreNotSaved")}
          </p>
        )}

        {/* ---- Video ---- */}
        {videoUrl && (
          <div
            className="w-full max-w-[280px] mb-4 relative animate-fade-in-up delay-160"
            style={{ borderRadius: "14px", border: "1px solid var(--color-border-subtle)", overflow: "hidden", backgroundColor: "#000", zIndex: 60 }}
          >
            {resultData.ffmpegProcessed ? (
              <video
                src={videoUrl}
                controls
                playsInline
                autoPlay
                muted
                loop
                className="w-full aspect-[9/16] object-contain"
                style={{ borderRadius: "14px" }}
              />
            ) : (
              <SlowMoPlayer
                src={videoUrl}
                slowStart={Math.max(0, resultData.peakOffset - 0.3)}
                slowEnd={resultData.peakOffset + 0.3}
                className="w-full aspect-[9/16] object-contain"
              />
            )}
          </div>
        )}

        {/* Video action buttons — secondary style */}
        {resultData.videoBlob && (
          <div className="grid gap-3 mb-5 w-full max-w-[280px] animate-fade-in-up delay-240" style={{ position: "relative", zIndex: 60, gridTemplateColumns: "1.3fr 1fr" }}>
            <button
              onClick={onSaveVideo}
              className="h-[46px] flex items-center justify-center text-foreground/80 text-[13px] font-medium active:scale-[0.97] transition-all hover:text-foreground game-border rounded-[12px]"
            >
              {t("result.downloadVideo")}
            </button>
            <button
              onClick={onShareVideo}
              className="h-[42px] flex items-center justify-center text-foreground/80 text-[13px] font-medium active:scale-[0.97] transition-all hover:text-foreground game-border rounded-[10px]"
            >
              {t("result.shareOn")}
            </button>
          </div>
        )}

        {/* ---- Primary CTA ---- */}
        <button
          onClick={onTryAgain}
          className="w-full max-w-[300px] bg-accent text-black cta-text text-[16px] tracking-[0.1em] active:scale-[0.97] transition-transform duration-100 animate-fade-in-up delay-320 neon-glow"
          style={{
            position: "relative",
            zIndex: 60,
            borderRadius: "12px",
            height: "52px",
          }}
        >
          {t("result.tryAgain")}
        </button>

        {/* Removed: World/JP rank card — user requested removal */}

        {/* Near-miss */}
        {tierInfo?.nearMiss && (
          <p
            className="mt-4 text-accent/70 text-[13px] tracking-[0.05em]"
            style={{ animation: "fade-in 0.4s ease-out 0.8s both" }}
          >
            {tierInfo.nearMiss.type === "tier"
              ? t("result.nearMissTier", {
                  remaining: tierInfo.nearMiss.remaining,
                  tier: t(`tier.${tierInfo.nearMiss.targetName}`),
                })
              : t("result.nearMissPB", {
                  remaining: tierInfo.nearMiss.remaining,
                })
            }
          </p>
        )}

        {/* Rankings */}
        {!rankings.loading && (rankings.world.length > 0 || rankings.country.length > 0) && (
          <div className="w-full mt-6 animate-fade-in delay-560">
            {rankings.world.length > 0 && (
              <RankingList
                title={t("landing.worldRanking")}
                entries={rankings.world}
              />
            )}
            {rankings.country.length > 0 && (
              <RankingList
                title={t("landing.countryRanking")}
                entries={rankings.country}
              />
            )}
          </div>
        )}

        {/* Ranking button */}
        <button
          onClick={() => router.push(`/${locale}/ranking`)}
          className="mt-4 w-full max-w-[200px] h-[40px] flex items-center justify-center text-foreground/70 text-[13px] font-medium hover:text-foreground active:scale-[0.97] transition-all animate-fade-in delay-560 game-border rounded-[8px]"
        >
          {t("mypage.viewRanking")}
        </button>

        {/* Thread button */}
        <button
          onClick={() => setShowThread(true)}
          className="mt-3 w-full max-w-[200px] h-[38px] flex items-center justify-center text-foreground/60 text-[13px] font-medium hover:text-foreground active:scale-[0.97] transition-all animate-fade-in delay-560 game-border rounded-[8px]"
        >
          {t("thread.voices")}
        </button>

        {/* Ghost back button */}
        <button
          onClick={onGoHome}
          className="mt-4 text-muted/50 text-[12px] tracking-[0.15em] uppercase active:scale-[0.97] transition-all hover:text-muted/70"
        >
          {t("result.backToTop")}
        </button>

        {/* Merch link */}
        <a href="https://kosukuma-official-shop.pages.dev/" target="_blank" rel="noopener noreferrer"
           className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 min-h-[44px] flex items-center active:scale-[0.97] game-border">
          グッズ
        </a>
      </div>

      <ThreadSheet open={showThread} onClose={() => setShowThread(false)} />

      {/* Cracker particles — wrapped in z-[5] stacking context so it renders
          behind the z-[60] content container. The inner canvas is z-50 but
          contained within the z-[5] wrapper, so it never blocks touch events. */}
      <div style={{ position: "fixed", inset: 0, zIndex: 5, pointerEvents: "none" }}>
        <CrackerParticles level={crackerActive ? achievement.crackerLevel : "none"} active={crackerActive} />
      </div>
    </main>
  );
}
