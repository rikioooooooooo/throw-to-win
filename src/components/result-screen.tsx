"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData } from "@/lib/storage";
import { CountUpHeight } from "@/components/count-up-height";
import { SlowMoPlayer } from "@/components/slow-mo-player";
import { RankingList } from "@/components/ranking-list";
import { useRankings } from "@/hooks/use-rankings";
import { TierIcon } from "@/components/tier-icon";
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
  const [todayStats] = useState(() => {
    if (typeof window === "undefined") return { todayBest: 0, streakDays: 0 };
    const d = loadData();
    return { todayBest: d.stats.todayBest, streakDays: d.stats.streakDays };
  });

  const tierColor =
    tierInfo?.isBreakthrough
      ? tierInfo.current.color
      : resultTier === "personal-best"
        ? "var(--color-accent)"
        : "var(--color-foreground)";

  return (
    <main className="fixed inset-0 z-10 flex flex-col items-center bg-background overflow-y-auto safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center px-6 py-8 w-full max-w-md">

        {/* ---- Height hero ---- */}
        <div className="text-center mt-4 mb-1 animate-fade-in-up">
          {resultData.isPersonalBest && (
            <p
              className="label-text text-[11px] tracking-[0.25em] text-accent mb-5"
              style={{
                animation: "spring-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both",
                backgroundColor: "rgba(0, 250, 154, 0.08)",
                border: "1px solid var(--color-accent)",
                borderRadius: "8px",
                padding: "4px 12px",
              }}
            >
              {t("result.newRecord")}
            </p>
          )}

          <div className="flex items-baseline justify-center">
            <CountUpHeight
              target={resultData.height}
              samples={resultData.samples.length > 0 ? resultData.samples : undefined}
              className="height-number leading-none"
              style={{
                color: tierColor,
                fontSize: "clamp(5rem, 28vw, 9rem)",
                textShadow: "0 0 30px currentColor",
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

          {/* Tier badge */}
          {tierInfo && (
            <div
              className="mt-3 flex items-center justify-center gap-2"
              style={{ animation: "badge-appear 0.3s ease-out 0.3s both" }}
            >
              <TierIcon tierId={tierInfo.current.id} size={40} />
              <span
                className="text-[14px] font-semibold tracking-[0.15em] uppercase"
                style={{ color: tierInfo.current.color }}
              >
                {t(`tier.${tierInfo.current.id}`)}
              </span>
              {tierInfo.isBreakthrough && (
                <span className="text-accent text-[12px] font-bold tracking-wider">{t("tier.new")}</span>
              )}
            </div>
          )}
        </div>

        {/* (仮) 達成アセット - PB更新/ティア昇格/ランク更新時に表示 */}
        <div className="flex justify-center mt-4">
          <div className="w-24 h-24 border border-dashed border-accent/20 rounded-lg flex items-center justify-center text-accent/30 text-[10px] text-center">
            （仮）<br/>達成アセット
          </div>
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
            className="w-full max-w-[260px] mb-5 relative overflow-hidden animate-fade-in-up delay-160"
            style={{ borderRadius: "14px" }}
          >
            {resultData.ffmpegProcessed ? (
              <video
                src={videoUrl}
                controls
                playsInline
                autoPlay
                muted
                loop
                className="w-full aspect-[9/16] object-cover"
                style={{ borderRadius: "14px" }}
              />
            ) : (
              <SlowMoPlayer
                src={videoUrl}
                slowStart={Math.max(0, resultData.peakOffset - 0.5)}
                slowEnd={resultData.peakOffset + 0.5}
                className="w-full aspect-[9/16] object-cover"
              />
            )}
          </div>
        )}

        {/* Video action buttons — secondary style */}
        {resultData.videoBlob && (
          <div className="grid grid-cols-2 gap-2 mb-5 w-full max-w-[260px] animate-fade-in-up delay-240">
            <button
              onClick={onSaveVideo}
              className="py-3 text-foreground/60 text-[12px] tracking-widest uppercase active:scale-[0.97] transition-all hover:text-foreground"
              style={{
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "10px",
              }}
            >
              {t("result.downloadVideo")}
            </button>
            <button
              onClick={onShareVideo}
              className="py-3 text-foreground/60 text-[12px] tracking-widest uppercase active:scale-[0.97] transition-all hover:text-foreground"
              style={{
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "10px",
              }}
            >
              {t("result.shareOn")}
            </button>
          </div>
        )}

        {/* ---- Primary CTA ---- */}
        <button
          onClick={onTryAgain}
          className="w-full max-w-[260px] bg-accent text-black cta-text text-[15px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-100 animate-fade-in-up delay-320 neon-glow"
          style={{
            borderRadius: "16px",
            height: "58px",
          }}
        >
          {t("result.tryAgain")}
        </button>

        {/* ---- Rank context ---- */}
        {rankingData && (
          <div className="mt-5 flex flex-col items-center animate-fade-in delay-480">
            <div className="flex items-center gap-3 text-[14px]">
              <span className="text-foreground/80 height-number">#{rankingData.worldRank}</span>
              <span className="text-muted/60 text-[12px]">WORLD</span>
              {rankingData.country && rankingData.country !== "XX" && (
                <>
                  <span className="text-muted/40">·</span>
                  <span className="text-foreground/80 height-number">#{rankingData.countryRank}</span>
                  <span className="text-muted/60 text-[12px]">{rankingData.country}</span>
                </>
              )}
            </div>
            <button
              onClick={() => router.push(`/${locale}/ranking`)}
              className="mt-1.5 text-muted/60 text-[12px] tracking-[0.1em] hover:text-foreground/50 transition-colors"
            >
              {t("ranking.viewRanking")} →
            </button>
          </div>
        )}

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

        {/* Ghost back button */}
        <button
          onClick={onGoHome}
          className="mt-4 text-muted/50 text-[12px] tracking-[0.15em] uppercase active:scale-[0.97] transition-all hover:text-muted/70"
        >
          {t("result.backToTop")}
        </button>
      </div>
    </main>
  );
}
