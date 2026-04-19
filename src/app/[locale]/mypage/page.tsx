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
    <main className="flex-1 flex flex-col min-h-screen safe-bottom">
      {/* Sticky header */}
      <header
        className="px-5 py-5 flex items-center justify-between sticky top-0 z-10 safe-top"
        style={{
          backgroundColor: "rgba(5, 5, 8, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <button
          onClick={() => router.push(`/${locale}`)}
          className="w-11 h-11 flex items-center justify-center active:scale-[0.97] transition-transform"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[18px] font-semibold tracking-wide uppercase">
          {t("heading")}
        </h1>
        <div className="w-11" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-10 animate-fade-in-up">
          {/* Personal best — full width, tier-colored glow */}
          <div
            className="col-span-2 p-5"
            style={{
              background: `linear-gradient(135deg, ${getTierForHeight(stats.personalBest).color}08 0%, transparent 60%) var(--color-surface)`,
              border: `1px solid ${getTierForHeight(stats.personalBest).color}40`,
              borderRadius: "16px",
              boxShadow: `0 2px 16px ${getTierForHeight(stats.personalBest).color}10`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <TierIcon tierId={getTierForHeight(stats.personalBest).id} size={24} />
              <p className="label-text text-[11px] tracking-[0.2em]" style={{ color: getTierForHeight(stats.personalBest).color }}>
                {t("personalBest")}
              </p>
            </div>
            <div className="flex items-end">
              <span className="height-number text-[52px] text-foreground leading-none">
                {formatHeight(stats.personalBest)}
              </span>
              <span className="text-[16px] text-muted/60 ml-1 mb-1">{t("meters")}</span>
            </div>
            {(() => {
              const next = getNextTier(stats.personalBest);
              if (!next) return null;
              return (
                <p className="mt-3 text-[12px] text-muted/70 tracking-[0.05em]">
                  <span style={{ color: next.tier.color }}>{next.remaining}m</span>
                  {" "}{t("nextTierTo")}{" "}
                  <span style={{ color: next.tier.color }}>{tTier(next.tier.id as never)}</span>
                </p>
              );
            })()}
          </div>

          <div
            className="p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%) var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[11px] tracking-[0.15em] text-muted/70 mb-2">
              {t("totalThrows")}
            </p>
            <span className="height-number text-[28px] text-foreground leading-none">
              {stats.totalThrows}
            </span>
          </div>

          <div
            className="p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%) var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[11px] tracking-[0.15em] text-muted/70 mb-2">
              {t("totalAirtime")}
            </p>
            <div className="flex items-end">
              <span className="height-number text-[28px] text-foreground leading-none">
                {formatAirtime(stats.totalAirtimeSeconds)}
              </span>
              <span className="text-[12px] text-muted/60 ml-1">{t("seconds")}</span>
            </div>
          </div>

          <div
            className="col-span-2 p-4"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%) var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[11px] tracking-[0.15em] text-muted/70 mb-2">
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
            <div
              className="col-span-2 p-4 flex items-center gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%) var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "14px",
              }}
            >
              <span className="text-[24px]">🔥</span>
              <div>
                <p className="label-text text-[11px] tracking-[0.15em] text-muted/70 mb-0.5">
                  {t("streak")}
                </p>
                <span className="height-number text-[22px] text-foreground leading-none">
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
            <h2 className="text-[16px] font-semibold tracking-wide uppercase">
              {t("throws")}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy("date")}
                className={`px-4 py-3 label-text text-[11px] tracking-wide transition-colors active:scale-[0.97] ${
                  sortBy === "date"
                    ? "text-accent"
                    : "text-muted"
                }`}
                style={{
                  backgroundColor: sortBy === "date" ? "rgba(0, 250, 154, 0.08)" : "var(--color-surface)",
                  border: sortBy === "date" ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                  borderRadius: "10px",
                }}
              >
                {t("sortByDate")}
              </button>
              <button
                onClick={() => setSortBy("height")}
                className={`px-4 py-3 label-text text-[11px] tracking-wide transition-colors active:scale-[0.97] ${
                  sortBy === "height"
                    ? "text-accent"
                    : "text-muted"
                }`}
                style={{
                  backgroundColor: sortBy === "height" ? "rgba(0, 250, 154, 0.08)" : "var(--color-surface)",
                  border: sortBy === "height" ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                  borderRadius: "10px",
                }}
              >
                {t("sortByHeight")}
              </button>
            </div>
          </div>

          {throws.length === 0 ? (
            <div
              className="flex flex-col items-center text-center py-12"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "14px",
              }}
            >
              <div className="flex justify-center mb-4">
                <div className="w-32 h-32 border border-dashed border-accent/20 rounded-lg flex items-center justify-center text-accent/30 text-[10px] text-center">
                  （仮）<br/>投擲記録
                </div>
              </div>
              <p className="text-muted text-[13px] tracking-[0.05em]">
                {t("noThrows")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {throws.map((record, index) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-4"
                  style={{
                    backgroundColor: record.isPersonalBest ? "rgba(0, 250, 154, 0.04)" : "var(--color-surface)",
                    border: record.isPersonalBest ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                    borderRadius: "12px",
                    opacity: 0,
                    animation: `fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 40}ms forwards`,
                  }}
                >
                  <div className="flex flex-col">
                    <span className="label-text text-[11px] tracking-[0.15em] text-muted mb-1">
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
                      className="px-2.5 py-1 bg-accent text-black label-text text-[11px] tracking-wider"
                      style={{ borderRadius: "6px" }}
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
      </div>
    </main>
  );
}
