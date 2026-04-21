"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { TIERS, getTierForHeight } from "@/lib/tiers";
import { loadData } from "@/lib/storage";
import { TierIcon } from "@/components/tier-icon";

type TierStats = {
  readonly totalUsers: number;
  readonly pbValues: readonly number[];
};

function formatTierHeight(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(0)}km`;
  if (meters >= 100) return `${meters.toFixed(0)}m`;
  return `${meters}m`;
}

export default function TiersPage() {
  const t = useTranslations();
  const tTier = useTranslations("tier");
  const router = useRouter();
  const locale = useLocale();

  const [stats, setStats] = useState<TierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const personalBest = typeof window !== "undefined" ? loadData().stats.personalBest : 0;
  const userTier = getTierForHeight(personalBest);

  useEffect(() => {
    fetch("/api/tier-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setStats(data as TierStats);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // --- Progressive unlock logic ---
  const myTierIndex = personalBest > 0
    ? TIERS.findIndex((t) => t.id === userTier.id)
    : -1;
  const maxUnlockedIndex = myTierIndex + 1; // reveals one above current
  const unknownIndex = maxUnlockedIndex + 1;
  const reachedTop = myTierIndex === TIERS.length - 1; // omega

  // Build visible tiers: unlocked ones (highest first) + ??? row
  const unlockedTiers = TIERS.slice(0, maxUnlockedIndex + 1);
  const unlockedReversed = [...unlockedTiers].reverse();
  const showUnknown = !reachedTop && unknownIndex < TIERS.length;

  function getTierAchievers(tierIndex: number): number {
    if (!stats) return 0;
    const tier = TIERS[tierIndex];
    const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null;
    return stats.pbValues.filter((pb) => {
      if (pb < tier.minHeight) return false;
      if (nextTier && pb >= nextTier.minHeight) return false;
      return true;
    }).length;
  }

  function getTopPercent(tierIndex: number): string | null {
    if (!stats || stats.pbValues.length < 10) return null;
    const tier = TIERS[tierIndex];
    const aboveCount = stats.pbValues.filter((pb) => pb >= tier.minHeight).length;
    const percent = (aboveCount / stats.pbValues.length) * 100;
    if (percent >= 100) return null;
    return percent < 0.1 ? "< 0.1" : percent.toFixed(1);
  }

  return (
    <main className="min-h-screen bg-background px-5 safe-top safe-bottom">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="radial-burst" style={{ opacity: 0.5 }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(0, 250, 154, 0.04) 0%, transparent 60%)" }} />
      </div>

      <div className="relative z-10">
        <header className="flex items-center justify-between pt-4 mb-6">
          <button
            onClick={() => router.back()}
            className="w-11 h-11 flex items-center justify-center active:scale-[0.97] transition-transform game-card"
            aria-label="Back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <img src="/assets/logo-landing.png" alt="" aria-hidden="true" style={{ width: 24, height: "auto", opacity: 0.6 }} />
            <h1 className="label-text text-[14px] tracking-[0.2em] text-foreground uppercase font-bold">
              {t("tiers.title")}
            </h1>
          </div>
          <div className="w-11" />
        </header>

        {reachedTop && (
          <div
            className="text-center mb-6 py-3"
            style={{
              opacity: 0,
              animation: "fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0ms forwards",
            }}
          >
            <span
              className="label-text text-[12px] tracking-[0.3em] font-bold"
              style={{ color: TIERS[TIERS.length - 1].color }}
            >
              {t("tiers.reachedTop")}
            </span>
          </div>
        )}

        {loading ? (
          <p className="text-center text-muted text-[13px] py-12">{t("common.loading")}</p>
        ) : error ? (
          <p className="text-center text-muted text-[13px] py-12">{t("common.error")}</p>
        ) : (
          <div className="space-y-1.5 pb-8">
            {unlockedReversed.map((tier, visualIndex) => {
              const originalIndex = TIERS.indexOf(tier);
              const nextTier = originalIndex < TIERS.length - 1 ? TIERS[originalIndex + 1] : null;
              const isUserTier = userTier.id === tier.id && personalBest > 0;
              const isReached = personalBest >= tier.minHeight && personalBest > 0;
              const achievers = getTierAchievers(originalIndex);
              const topPercent = getTopPercent(originalIndex);
              const heightRange = nextTier
                ? `${formatTierHeight(tier.minHeight)} - ${formatTierHeight(nextTier.minHeight)}`
                : `${formatTierHeight(tier.minHeight)}+`;

              return (
                <div
                  key={tier.id}
                  className="flex items-center gap-3 p-3 relative overflow-hidden"
                  style={{
                    backgroundColor: isUserTier ? `${tier.color}15` : "var(--color-surface)",
                    border: isUserTier ? `1.5px solid ${tier.color}60` : "1px solid var(--color-border-game)",
                    borderRadius: "14px",
                    opacity: 0,
                    animation: `fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(visualIndex * 30, 500)}ms forwards`,
                  }}
                >
                  {isUserTier && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: `linear-gradient(90deg, transparent, ${tier.color}60, transparent)` }}
                    />
                  )}

                  <TierIcon tierId={tier.id} size={48} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="label-text text-[13px] font-bold tracking-wide"
                        style={{ color: tier.color }}
                      >
                        {tTier(tier.id as never)}
                      </span>
                      {isUserTier && (
                        <span
                          className="label-text text-[9px] tracking-[0.2em] font-bold px-2 py-0.5"
                          style={{
                            backgroundColor: `${tier.color}30`,
                            color: tier.color,
                            borderRadius: "6px",
                          }}
                        >
                          {t("tiers.you")}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted/60 height-number tracking-wide">
                      {heightRange}
                    </span>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    {isReached ? (
                      <>
                        {stats && stats.pbValues.length >= 10 && topPercent ? (
                          <span className="text-[11px] text-foreground/70 height-number">
                            {t("tiers.topPercent", { percent: topPercent })}
                          </span>
                        ) : null}
                        <span className="text-[10px] text-muted/40 height-number">
                          {achievers}
                        </span>
                      </>
                    ) : (
                      <span
                        className="label-text text-[10px] tracking-[0.1em]"
                        style={{ color: `${tier.color}60` }}
                      >
                        {t("tiers.unreached")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ??? unknown tier row */}
            {showUnknown && (
              <div
                className="flex items-center gap-3 p-3 relative overflow-hidden"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border-game)",
                  borderRadius: "14px",
                  opacity: 0,
                  animation: `fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(unlockedReversed.length * 30, 500)}ms forwards`,
                }}
              >
                {/* Pulsing unknown icon placeholder */}
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--color-border-game)",
                    animation: "tier-unknown-pulse 3s ease-in-out infinite",
                  }}
                >
                  <span className="text-[18px] text-muted/40 font-bold select-none">?</span>
                </div>

                <div className="flex-1 min-w-0">
                  <span
                    className="label-text text-[13px] font-bold tracking-wide"
                    style={{
                      color: "var(--color-muted)",
                      animation: "tier-unknown-pulse 3s ease-in-out infinite",
                    }}
                  >
                    ???
                  </span>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span
                    className="label-text text-[10px] tracking-[0.1em] text-muted/30"
                    style={{ animation: "tier-unknown-pulse 3s ease-in-out infinite" }}
                  >
                    {t("tiers.unreached")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
