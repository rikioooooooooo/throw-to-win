"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { loadData, hasValidConsent, saveConsent } from "@/lib/storage";
import { formatHeight } from "@/lib/physics";
import { ConsentModal } from "@/components/consent-modal";
import { RankingList, type RankEntry } from "@/components/ranking-list";

type RankingState = {
  readonly world: readonly RankEntry[];
  readonly country: readonly RankEntry[];
  readonly yourCountry: string;
};

export default function LandingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [showConsent, setShowConsent] = useState(false);
  const [rankings, setRankings] = useState<RankingState | null>(null);
  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0 };
    return loadData().stats;
  });

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

        let countryRankings: RankEntry[] = [];
        if (worldData.yourCountry && worldData.yourCountry !== "XX") {
          const countryRes = await fetch(
            `/api/ranking?scope=country&country=${worldData.yourCountry}&limit=10`,
          );
          if (countryRes.ok) {
            const countryData = await countryRes.json() as { rankings: RankEntry[] };
            countryRankings = countryData.rankings;
          }
        }

        if (!cancelled) {
          setRankings({
            world: worldData.rankings,
            country: countryRankings,
            yourCountry: worldData.yourCountry,
          });
        }
      } catch {
        // Silent fail
      }
    }

    fetchRankings();
    return () => { cancelled = true; };
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

  const goToRanking = () => router.push(`/${locale}/ranking`);

  return (
    <main className="relative flex-1 flex flex-col min-h-screen px-5 overflow-y-auto safe-bottom">
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
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center pb-8">
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
          <div className="mt-10 flex flex-col items-center animate-fade-in-up delay-160">
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
          <div className="flex gap-12 mt-6 animate-fade-in-up delay-240">
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

      {/* Rankings */}
      {rankings && (rankings.world.length > 0 || rankings.country.length > 0) && (
        <div className="relative z-10 w-full max-w-[400px] mx-auto pb-4 animate-fade-in-up delay-320">
          {rankings.world.length > 0 && (
            <RankingList
              title={t("landing.worldRanking")}
              entries={rankings.world}
              actionLabel={t("ranking.seeMore")}
              onAction={goToRanking}
            />
          )}
          {rankings.country.length > 0 && (
            <RankingList
              title={t("landing.countryRanking")}
              entries={rankings.country}
              actionLabel={t("ranking.seeMore")}
              onAction={goToRanking}
            />
          )}
        </div>
      )}

      {/* CTA */}
      <div className="relative z-10 sticky bottom-0 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
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
