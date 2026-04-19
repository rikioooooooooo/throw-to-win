"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { loadData, getSortedThrows, getDisplayName, saveDisplayName } from "@/lib/storage";
import { formatHeight, formatAirtime } from "@/lib/physics";
import { getTierForHeight, getNextTier } from "@/lib/tiers";
import { generateFingerprint } from "@/lib/fingerprint";
import { TierIcon } from "@/components/tier-icon";
import { NameInput } from "@/components/name-input";
import { WorldMap } from "@/components/world-map";
import type { ThrowRecord } from "@/lib/types";

type WorldCountry = {
  readonly country: string;
  readonly throws: number;
  readonly players: number;
  readonly best: number;
};

export default function MyPage() {
  const t = useTranslations("mypage");
  const tTier = useTranslations("tier");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0, totalHeightMeters: 0, todayDateISO: "", todayBest: 0, streakDays: 0, lastActiveDateISO: "" };
    return loadData().stats;
  });
  const [displayName, setDisplayName] = useState(() =>
    typeof window !== "undefined" ? getDisplayName() : "",
  );
  const [savingName, setSavingName] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "height">("date");
  const throws: readonly ThrowRecord[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    return getSortedThrows(sortBy);
  }, [sortBy]);
  const [worldCountries, setWorldCountries] = useState<readonly WorldCountry[]>([]);

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
    fetch("/api/world")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.countries) setWorldCountries(data.countries);
      })
      .catch(() => {
        // silent
      });
  }, []);

  return (
    <main className="flex-1 flex flex-col min-h-screen safe-bottom relative">
      {/* Background ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 20%, rgba(0, 250, 154, 0.04) 0%, transparent 50%)" }} />
      </div>
      {/* Sticky header */}
      <header
        className="px-5 py-5 flex items-center justify-between sticky top-0 z-10 safe-top"
        style={{
          backgroundColor: "rgba(5, 10, 8, 0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--color-border-game)",
        }}
      >
        <button
          onClick={() => router.push(`/${locale}`)}
          className="w-11 h-11 flex items-center justify-center active:scale-[0.97] transition-transform game-card"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <img src="/assets/logo-landing.png" alt="" aria-hidden="true" style={{ width: 24, height: "auto", opacity: 0.6 }} />
          <h1 className="text-[18px] font-bold tracking-wide uppercase">
            {t("heading")}
          </h1>
        </div>
        <a href="https://kosukuma-official-shop.pages.dev/" target="_blank" rel="noopener noreferrer"
           className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97] game-border">
          グッズ
        </a>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Stats grid — game stat screen */}
        <div className="grid grid-cols-2 gap-3 mb-10 animate-fade-in-up">
          {/* Personal best — CROWN ACHIEVEMENT — dramatic game card */}
          <div
            className="col-span-2 p-5 relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${getTierForHeight(stats.personalBest).color}10 0%, transparent 50%) var(--color-surface)`,
              border: `2px solid ${getTierForHeight(stats.personalBest).color}50`,
              borderRadius: "18px",
              boxShadow: `0 4px 24px ${getTierForHeight(stats.personalBest).color}15, 0 0 0 1px ${getTierForHeight(stats.personalBest).color}10`,
            }}
          >
            {/* Top highlight line */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ background: `linear-gradient(90deg, transparent, ${getTierForHeight(stats.personalBest).color}60, transparent)` }}
            />
            {/* Subtle radial burst inside PB card */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle at 80% 20%, ${getTierForHeight(stats.personalBest).color}08, transparent 50%)`,
              }}
            />
            <div className="flex items-center gap-2 mb-3 relative">
              <TierIcon tierId={getTierForHeight(stats.personalBest).id} size={32} />
              <p className="label-text text-[12px] tracking-[0.2em] font-bold" style={{ color: getTierForHeight(stats.personalBest).color }}>
                {t("personalBest")}
              </p>
            </div>
            <div className="flex items-end relative">
              <span className="height-number text-[56px] text-foreground leading-none" style={{
                textShadow: `0 0 30px ${getTierForHeight(stats.personalBest).color}30`,
              }}>
                {formatHeight(stats.personalBest)}
              </span>
              <span className="text-[16px] text-muted/60 ml-1 mb-1">{t("meters")}</span>
            </div>
            {(() => {
              const next = getNextTier(stats.personalBest);
              if (!next) return null;
              return (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-[3px] rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ((stats.personalBest - getTierForHeight(stats.personalBest).minHeight) / (next.tier.minHeight - getTierForHeight(stats.personalBest).minHeight)) * 100)}%`,
                        background: `linear-gradient(90deg, ${getTierForHeight(stats.personalBest).color}, ${next.tier.color})`,
                        boxShadow: `0 0 6px ${getTierForHeight(stats.personalBest).color}50`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted/70 tracking-[0.05em] shrink-0">
                    <span style={{ color: next.tier.color }}>{next.remaining}m</span>
                    {" "}{t("nextTierTo")}{" "}
                    <span style={{ color: next.tier.color }}>{tTier(next.tier.id as never)}</span>
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Stat cards — game card style */}
          <div className="game-card p-4">
            <p className="label-text text-[11px] tracking-[0.15em] text-accent/50 mb-2">
              {t("totalThrows")}
            </p>
            <span className="height-number text-[28px] text-foreground leading-none">
              {stats.totalThrows}
            </span>
          </div>

          <div className="game-card p-4">
            <p className="label-text text-[11px] tracking-[0.15em] text-accent/50 mb-2">
              {t("totalAirtime")}
            </p>
            <div className="flex items-end">
              <span className="height-number text-[28px] text-foreground leading-none">
                {formatAirtime(stats.totalAirtimeSeconds)}
              </span>
              <span className="text-[12px] text-muted/60 ml-1">{t("seconds")}</span>
            </div>
          </div>

          <div className="game-card col-span-2 p-4">
            <p className="label-text text-[11px] tracking-[0.15em] text-accent/50 mb-2">
              {t("totalHeight")}
            </p>
            <div className="flex items-end">
              <span className="height-number text-[28px] text-foreground leading-none">
                {stats.totalHeightMeters.toFixed(1)}
              </span>
              <span className="text-[12px] text-muted/60 ml-1">{t("meters")}</span>
            </div>
          </div>

          {stats.streakDays > 0 && (
            <div className="game-card col-span-2 p-4 flex items-center gap-3">
              <span className="text-[28px]">🔥</span>
              <div>
                <p className="label-text text-[11px] tracking-[0.15em] text-accent/50 mb-0.5">
                  {t("streak")}
                </p>
                <span className="height-number text-[24px] text-foreground leading-none">
                  {stats.streakDays}
                </span>
                <span className="text-[12px] text-muted/60 ml-1">{t("days")}</span>
              </div>
            </div>
          )}
        </div>

        {/* Name editing */}
        <div className="mb-8 animate-fade-in-up delay-160">
          <NameInput
            currentName={displayName}
            onSave={handleSaveName}
            saving={savingName}
          />
        </div>

        {/* Sort toggle + throw list */}
        <div className="animate-fade-in-up delay-80">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-bold tracking-wide uppercase">
              {t("throws")}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy("date")}
                className={`px-4 py-3 label-text text-[11px] tracking-wide transition-all active:scale-[0.97] ${
                  sortBy === "date"
                    ? "text-accent"
                    : "text-muted"
                }`}
                style={{
                  backgroundColor: sortBy === "date" ? "rgba(0, 250, 154, 0.1)" : "var(--color-surface)",
                  border: sortBy === "date" ? "1px solid var(--color-accent)" : "1px solid var(--color-border-game)",
                  borderRadius: "10px",
                }}
              >
                {t("sortByDate")}
              </button>
              <button
                onClick={() => setSortBy("height")}
                className={`px-4 py-3 label-text text-[11px] tracking-wide transition-all active:scale-[0.97] ${
                  sortBy === "height"
                    ? "text-accent"
                    : "text-muted"
                }`}
                style={{
                  backgroundColor: sortBy === "height" ? "rgba(0, 250, 154, 0.1)" : "var(--color-surface)",
                  border: sortBy === "height" ? "1px solid var(--color-accent)" : "1px solid var(--color-border-game)",
                  borderRadius: "10px",
                }}
              >
                {t("sortByHeight")}
              </button>
            </div>
          </div>

          {throws.length === 0 ? (
            <div className="game-card flex flex-col items-center text-center py-12 px-6">
              <img
                src="/assets/final/state/empty-ranking.png"
                alt=""
                aria-hidden="true"
                style={{ width: "64px", height: "64px", marginBottom: "12px", opacity: 0.6 }}
              />
              <p className="text-muted text-[13px] tracking-[0.05em]">
                {t("noThrows")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {throws.map((record, index) => (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-4 relative overflow-hidden ${record.isPersonalBest ? "" : "game-card"}`}
                  style={{
                    ...(record.isPersonalBest ? {
                      background: `linear-gradient(135deg, rgba(0, 250, 154, 0.06) 0%, transparent 50%) var(--color-surface)`,
                      border: "1px solid rgba(0, 250, 154, 0.3)",
                      borderRadius: "16px",
                      boxShadow: "0 0 12px rgba(0, 250, 154, 0.08)",
                    } : {}),
                    opacity: 0,
                    animation: `fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 40}ms forwards`,
                  }}
                >
                  {/* PB glow line at top */}
                  {record.isPersonalBest && (
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: "linear-gradient(90deg, transparent, rgba(0, 250, 154, 0.5), transparent)" }}
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="label-text text-[10px] tracking-[0.15em] text-muted mb-1">
                      {new Date(record.timestamp).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span
                        className="height-number text-[22px]"
                        style={{
                          color: record.isPersonalBest ? "var(--color-accent)" : "var(--color-foreground)",
                          textShadow: record.isPersonalBest ? "0 0 12px rgba(0, 250, 154, 0.3)" : "none",
                        }}
                      >
                        {formatHeight(record.heightMeters)}m
                      </span>
                      <span className="text-[13px] text-muted height-number">
                        {formatAirtime(record.airtimeSeconds)}s
                      </span>
                    </div>
                  </div>
                  {record.isPersonalBest && (
                    <div
                      className="px-3 py-1.5 bg-accent text-black label-text text-[10px] tracking-[0.2em] font-bold"
                      style={{ borderRadius: "8px", boxShadow: "0 0 8px rgba(0, 250, 154, 0.25)" }}
                    >
                      PB
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* World throws */}
        <div className="mt-10 animate-fade-in-up delay-160">
          <h2 className="text-[16px] font-semibold tracking-wide uppercase mb-6">
            {t("worldThrows")}
          </h2>
          <WorldMap countries={worldCountries} />
        </div>
        {/* Merch link */}
        <div className="mt-6 flex justify-center">
          <a href="https://kosukuma-official-shop.pages.dev/" target="_blank" rel="noopener noreferrer"
             className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97] game-border">
            グッズ
          </a>
        </div>
      </div>
    </main>
  );
}
