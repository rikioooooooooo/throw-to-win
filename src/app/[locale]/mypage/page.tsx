"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { loadData, getSortedThrows } from "@/lib/storage";
import { formatHeight, formatAirtime } from "@/lib/physics";
import type { ThrowRecord } from "@/lib/types";

export default function MyPage() {
  const t = useTranslations("mypage");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";
  const [stats] = useState(() => {
    if (typeof window === "undefined") return { personalBest: 0, totalThrows: 0, totalAirtimeSeconds: 0 };
    return loadData().stats;
  });
  const [sortBy, setSortBy] = useState<"date" | "height">("date");
  const throws: readonly ThrowRecord[] = useMemo(() => {
    if (typeof window === "undefined") return [];
    return getSortedThrows(sortBy);
  }, [sortBy]);

  return (
    <main className="flex-1 flex flex-col min-h-screen safe-bottom">
      {/* Sticky header */}
      <header
        className="px-5 py-5 flex items-center justify-between sticky top-0 z-10 safe-top"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
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

      <div className="flex-1 overflow-y-auto px-5 py-8">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4 mb-10 animate-fade-in-up">
          {/* Personal best — full width card with accent */}
          <div
            className="col-span-2 p-5"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-accent)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[10px] tracking-[0.2em] text-accent mb-2">
              {t("personalBest")}
            </p>
            <div className="flex items-end">
              <span
                className="height-number text-[48px] text-foreground leading-none"
              >
                {formatHeight(stats.personalBest)}
              </span>
              <span className="text-[18px] text-muted ml-1 mb-1">{t("meters")}</span>
            </div>
          </div>

          <div
            className="p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[10px] tracking-[0.15em] text-muted mb-2">
              {t("totalThrows")}
            </p>
            <span className="height-number text-[28px] text-foreground leading-none">
              {stats.totalThrows}
            </span>
          </div>

          <div
            className="p-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "14px",
            }}
          >
            <p className="label-text text-[10px] tracking-[0.15em] text-muted mb-2">
              {t("totalAirtime")}
            </p>
            <div className="flex items-end">
              <span className="height-number text-[28px] text-foreground leading-none">
                {formatAirtime(stats.totalAirtimeSeconds)}
              </span>
              <span className="text-[12px] text-muted ml-1">{t("seconds")}</span>
            </div>
          </div>
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
                  backgroundColor: sortBy === "date" ? "rgba(255, 45, 45, 0.1)" : "var(--color-surface)",
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
                  backgroundColor: sortBy === "height" ? "rgba(255, 45, 45, 0.1)" : "var(--color-surface)",
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
              className="text-center py-12"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "14px",
              }}
            >
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
                    backgroundColor: record.isPersonalBest ? "rgba(255, 45, 45, 0.05)" : "var(--color-surface)",
                    border: record.isPersonalBest ? "1px solid var(--color-accent)" : "1px solid var(--color-border-subtle)",
                    borderRadius: "12px",
                    opacity: 0,
                    animation: `fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 40}ms forwards`,
                  }}
                >
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
                      className="px-2.5 py-1 bg-accent text-white label-text text-[11px] tracking-wider"
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
      </div>
    </main>
  );
}
