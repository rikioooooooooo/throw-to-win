"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { formatHeight } from "@/lib/physics";
import { getDisplayName, saveDisplayName } from "@/lib/storage";
import { generateFingerprint } from "@/lib/fingerprint";
import { SlowMoPlayer } from "@/components/slow-mo-player";
import { RankingList, type RankEntry } from "@/components/ranking-list";
import { NameInput } from "@/components/name-input";
import type { HeightTier } from "@/components/height-display";
import type { VerifyResponse } from "@/lib/challenge";

type ResultData = {
  readonly height: number;
  readonly airtime: number;
  readonly isPersonalBest: boolean;
  readonly videoBlob: Blob | null;
  readonly peakOffset: number;
  readonly ffmpegProcessed: boolean;
};

type ResultScreenProps = {
  readonly resultData: ResultData;
  readonly rankingData: VerifyResponse | null;
  readonly videoUrl: string | null;
  readonly resultTier: HeightTier;
  readonly onSaveVideo: () => void;
  readonly onShareVideo: () => void;
  readonly onTryAgain: () => void;
  readonly onGoHome: () => void;
};

export function ResultScreen({
  resultData,
  rankingData,
  videoUrl,
  resultTier,
  onSaveVideo,
  onShareVideo,
  onTryAgain,
  onGoHome,
}: ResultScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [worldEntries, setWorldEntries] = useState<readonly RankEntry[]>([]);
  const [countryEntries, setCountryEntries] = useState<readonly RankEntry[]>([]);
  const [displayName, setDisplayName] = useState(() =>
    typeof window !== "undefined" ? getDisplayName() : "",
  );
  const [savingName, setSavingName] = useState(false);

  const handleSaveName = useCallback(async (name: string) => {
    setSavingName(true);
    try {
      const fingerprint = await generateFingerprint();
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint: fingerprint, displayName: name }),
      });
      if (res.ok) {
        saveDisplayName(name);
        setDisplayName(name);
      }
    } catch {
      // silent
    } finally {
      setSavingName(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchRankings() {
      try {
        const worldRes = await fetch("/api/ranking?scope=world&limit=10");
        if (!worldRes.ok) return;
        const worldData = await worldRes.json() as {
          rankings: RankEntry[];
          yourCountry: string;
        };
        if (cancelled) return;
        setWorldEntries(worldData.rankings);

        if (worldData.yourCountry && worldData.yourCountry !== "XX") {
          const countryRes = await fetch(
            `/api/ranking?scope=country&country=${worldData.yourCountry}&limit=10`,
          );
          if (countryRes.ok) {
            const countryData = await countryRes.json() as { rankings: RankEntry[] };
            if (!cancelled) setCountryEntries(countryData.rankings);
          }
        }
      } catch {
        // silent
      }
    }

    fetchRankings();
    return () => { cancelled = true; };
  }, []);

  const goToRanking = () => router.push(`/${locale}/ranking`);

  const tierColor =
    resultTier === "rank-update"
      ? "var(--color-accent-gold)"
      : resultTier === "personal-best"
        ? "var(--color-accent)"
        : "var(--color-foreground)";

  return (
    <main className="fixed inset-0 z-10 flex flex-col items-center bg-background overflow-y-auto safe-top safe-bottom">
      <div className="flex-1 flex flex-col items-center px-5 py-10 w-full max-w-[400px]">
        {resultData.isPersonalBest && (
          <div
            className="mb-6 px-4 py-2 label-text text-[10px] tracking-widest text-accent animate-fade-in-up"
            style={{
              border: "1px solid var(--color-accent)",
              borderRadius: "8px",
            }}
          >
            {t("result.newRecord")}
          </div>
        )}

        <div className="text-center mb-2 animate-fade-in-up delay-80">
          <p className="label-text text-muted/40 text-[10px] tracking-[0.2em] mb-4">
            {t("result.height")}
          </p>
          <div className="flex items-baseline justify-center">
            <span
              className="height-number text-[clamp(4rem,20vw,6rem)] leading-none"
              style={{ color: tierColor }}
            >
              {formatHeight(resultData.height)}
            </span>
            <span
              className="text-[24px] ml-1"
              style={{
                color: resultTier === "personal-best"
                  ? "rgba(255, 45, 45, 0.5)"
                  : "var(--color-muted)",
              }}
            >
              m
            </span>
          </div>
        </div>

        <p className="text-muted/40 text-[13px] tracking-[0.1em] mb-6 animate-fade-in-up delay-160">
          {t("result.airtime")}: <span className="text-foreground height-number">{resultData.airtime.toFixed(2)}s</span>
        </p>

        {rankingData && (
          <div className="flex gap-4 mb-8 w-full animate-fade-in-up delay-240">
            <div
              className="flex-1 p-4 text-center"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "12px",
              }}
            >
              <p className="label-text text-[9px] tracking-[0.2em] text-muted/50 mb-2">
                {t("result.worldRank")}
              </p>
              <span className="height-number text-[24px] text-foreground">
                #{rankingData.worldRank}
              </span>
            </div>
            <div
              className="flex-1 p-4 text-center"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "12px",
              }}
            >
              <p className="label-text text-[9px] tracking-[0.2em] text-muted/50 mb-2">
                {t("result.countryRank")}
              </p>
              <span className="height-number text-[24px] text-foreground">
                #{rankingData.countryRank}
              </span>
            </div>
          </div>
        )}

        {videoUrl && (
          <div
            className="w-full max-w-[280px] mb-8 relative overflow-hidden animate-fade-in-up delay-240"
            style={{
              backgroundColor: "var(--color-surface)",
              borderRadius: "12px",
            }}
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
                style={{ borderRadius: "12px" }}
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

        {resultData.videoBlob && (
          <div className="grid grid-cols-2 gap-2 mb-6 w-full max-w-[280px] animate-fade-in-up delay-320">
            <button
              onClick={onSaveVideo}
              className="py-4 text-foreground label-text text-[10px] tracking-widest active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "10px",
              }}
            >
              {t("result.downloadVideo")}
            </button>
            <button
              onClick={onShareVideo}
              className="py-4 text-foreground label-text text-[10px] tracking-widest active:scale-[0.97] transition-transform"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "10px",
              }}
            >
              {t("result.shareOn")}
            </button>
          </div>
        )}

        {/* Name input */}
        {!displayName && (
          <div className="w-full mb-6 animate-fade-in-up delay-320">
            <NameInput
              currentName={displayName}
              onSave={handleSaveName}
              saving={savingName}
            />
          </div>
        )}

        {/* Ranking lists */}
        {(worldEntries.length > 0 || countryEntries.length > 0) && (
          <div className="w-full mb-6 animate-fade-in-up delay-320">
            {worldEntries.length > 0 && (
              <RankingList
                title={t("landing.worldRanking")}
                entries={worldEntries}
                actionLabel={t("ranking.seeMore")}
                onAction={goToRanking}
              />
            )}
            {countryEntries.length > 0 && (
              <RankingList
                title={t("landing.countryRanking")}
                entries={countryEntries}
                actionLabel={t("ranking.seeMore")}
                onAction={goToRanking}
              />
            )}
          </div>
        )}

        <button
          onClick={onTryAgain}
          className="w-full max-w-[280px] py-4 bg-accent text-white cta-text text-[16px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-100 animate-fade-in-up delay-400"
          style={{ borderRadius: "14px", height: "56px" }}
        >
          {t("result.tryAgain")}
        </button>

        <button
          onClick={onGoHome}
          className="mt-3 w-full max-w-[280px] py-4 text-muted label-text text-[12px] tracking-widest active:scale-[0.97] transition-all duration-100 hover:text-foreground animate-fade-in-up delay-400"
        >
          {t("result.backToTop")}
        </button>
      </div>
    </main>
  );
}
