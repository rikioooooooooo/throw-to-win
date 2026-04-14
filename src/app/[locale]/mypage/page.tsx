"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { loadData, getSortedThrows } from "@/lib/storage";
import { formatHeight, formatAirtime } from "@/lib/physics";
import type { ThrowRecord, UserStats } from "@/lib/types";

export default function MyPage() {
  const t = useTranslations("mypage");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const [stats, setStats] = useState<UserStats>({
    personalBest: 0,
    totalThrows: 0,
    totalAirtimeSeconds: 0,
  });
  const [throws, setThrows] = useState<readonly ThrowRecord[]>([]);
  const [sortBy, setSortBy] = useState<"date" | "height">("date");

  useEffect(() => {
    const data = loadData();
    setStats(data.stats);
    setThrows(getSortedThrows(sortBy));
  }, [sortBy]);

  return (
    <main className="flex-1 flex flex-col min-h-screen safe-bottom">
      {/* Sticky header */}
      <header className="px-6 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-md z-10 safe-top">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="w-10 h-10 border border-border bg-surface flex items-center justify-center active:scale-[0.97] transition-transform"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-[22px] font-black tracking-widest uppercase">
          {t("heading")}
        </h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-12 animate-fade-in-up">
          {/* Personal best — spans full width, red border */}
          <div className="col-span-2 bg-surface border border-accent p-6 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-accent blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity" />
            <p className="text-[10px] tracking-[0.3em] text-accent uppercase mb-2">
              {t("personalBest")}
            </p>
            <div className="flex items-end text-glow">
              <span className="font-display text-[48px] font-black text-white hud-number leading-none tracking-tighter">
                {formatHeight(stats.personalBest)}
              </span>
              <span className="font-display text-[18px] text-muted ml-1 mb-1">{t("meters")}</span>
            </div>
          </div>

          <div className="bg-surface border border-border p-4">
            <p className="text-[10px] tracking-[0.2em] text-muted uppercase mb-2">
              {t("totalThrows")}
            </p>
            <span className="font-display text-[28px] font-black text-white hud-number leading-none">
              {stats.totalThrows}
            </span>
          </div>

          <div className="bg-surface border border-border p-4">
            <p className="text-[10px] tracking-[0.2em] text-muted uppercase mb-2">
              {t("totalAirtime")}
            </p>
            <div className="flex items-end">
              <span className="font-display text-[28px] font-black text-white hud-number leading-none">
                {formatAirtime(stats.totalAirtimeSeconds)}
              </span>
              <span className="font-display text-[12px] text-muted ml-1">{t("seconds")}</span>
            </div>
          </div>
        </div>

        {/* Sort toggle + throw list */}
        <div className="animate-fade-in-up delay-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-[18px] font-black tracking-widest uppercase">
              {t("throws")}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy("date")}
                className={`px-4 py-2.5 font-display text-[11px] tracking-widest uppercase border transition-colors active:scale-[0.97] ${
                  sortBy === "date"
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted bg-surface"
                }`}
              >
                {t("sortByDate")}
              </button>
              <button
                onClick={() => setSortBy("height")}
                className={`px-4 py-2.5 font-display text-[11px] tracking-widest uppercase border transition-colors active:scale-[0.97] ${
                  sortBy === "height"
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted bg-surface"
                }`}
              >
                {t("sortByHeight")}
              </button>
            </div>
          </div>

          {throws.length === 0 ? (
            <div className="text-center py-12 border border-border bg-surface">
              <p className="text-muted text-[13px] tracking-[0.1em] uppercase">
                {t("noThrows")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {throws.map((record) => (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-4 border ${
                    record.isPersonalBest
                      ? "border-accent bg-accent/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-[10px] tracking-[0.2em] text-muted uppercase mb-1">
                      {new Date(record.timestamp).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <div className="flex items-baseline gap-3">
                      <span
                        className={`font-display text-[22px] font-black hud-number ${
                          record.isPersonalBest ? "text-accent text-glow" : "text-white"
                        }`}
                      >
                        {formatHeight(record.heightMeters)}m
                      </span>
                      <span className="font-display text-[13px] text-muted hud-number">
                        {formatAirtime(record.airtimeSeconds)}s
                      </span>
                    </div>
                  </div>
                  {record.isPersonalBest && (
                    <div className="px-2.5 py-1 bg-accent text-white font-display text-[11px] tracking-widest uppercase">
                      PB
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
