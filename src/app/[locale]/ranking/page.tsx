"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { RankingList } from "@/components/ranking-list";
import { useRankings } from "@/hooks/use-rankings";

type Tab = "world" | "country";

export default function RankingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("world");
  const rankings = useRankings({ limit: 100 });

  const entries = tab === "world" ? rankings.world : rankings.country;
  const title = tab === "world" ? t("landing.worldRanking") : t("landing.countryRanking");

  return (
    <main className="min-h-screen bg-background px-5 safe-top safe-bottom">
      <header className="flex items-center justify-between pt-4 mb-6">
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
        <h1 className="label-text text-[12px] tracking-[0.2em] text-foreground uppercase">
          {t("ranking.heading")}
        </h1>
        <div className="w-11" />
      </header>

      {/* Tabs */}
      <div
        className="flex mb-6 overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "10px",
        }}
      >
        <button
          onClick={() => setTab("world")}
          className="flex-1 py-3.5 text-center label-text text-[11px] tracking-[0.15em] transition-colors"
          style={{
            backgroundColor: tab === "world" ? "var(--color-accent)" : "transparent",
            color: tab === "world" ? "#ffffff" : "var(--color-muted)",
          }}
        >
          {t("ranking.world")}
        </button>
        <button
          onClick={() => setTab("country")}
          className="flex-1 py-3.5 text-center label-text text-[11px] tracking-[0.15em] transition-colors"
          style={{
            backgroundColor: tab === "country" ? "var(--color-accent)" : "transparent",
            color: tab === "country" ? "#ffffff" : "var(--color-muted)",
          }}
        >
          {t("ranking.country")}
          {rankings.yourCountry && rankings.yourCountry !== "XX" && (
            <span className="ml-1 text-[11px] opacity-70">({rankings.yourCountry})</span>
          )}
        </button>
      </div>

      {rankings.loading ? (
        <p className="text-center text-muted text-[13px] py-12">{t("common.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted text-[13px] py-12">{t("landing.noRankings")}</p>
      ) : (
        <div className="pb-8">
          <RankingList title={title} entries={entries} />
        </div>
      )}
    </main>
  );
}
