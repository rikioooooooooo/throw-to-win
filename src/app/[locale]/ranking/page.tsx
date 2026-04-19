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
      {/* Layered background — radial burst + green ambient glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="radial-burst" style={{ opacity: 0.5 }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(0, 250, 154, 0.04) 0%, transparent 60%)" }} />
      </div>

      <div className="relative z-10">
        <header className="flex items-center justify-between pt-4 mb-6">
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
            <h1 className="label-text text-[14px] tracking-[0.2em] text-foreground uppercase font-bold">
              {t("ranking.heading")}
            </h1>
          </div>
          <a href="https://kosukumaofficialshop.pages.dev/" target="_blank" rel="noopener noreferrer"
             className="label-text text-[12px] text-foreground/40 hover:text-foreground transition-colors px-3 py-1.5 active:scale-[0.97] game-border">
            グッズ
          </a>
        </header>

        {/* Tabs — game-card style */}
        <div
          className="flex mb-6 overflow-hidden game-card"
          style={{ padding: 0 }}
        >
          <button
            onClick={() => setTab("world")}
            className="flex-1 py-3.5 text-center label-text text-[11px] tracking-[0.15em] transition-all"
            style={{
              backgroundColor: tab === "world" ? "var(--color-accent)" : "transparent",
              color: tab === "world" ? "#000000" : "var(--color-muted)",
              fontWeight: tab === "world" ? 800 : 600,
            }}
          >
            {t("ranking.world")}
          </button>
          <button
            onClick={() => setTab("country")}
            className="flex-1 py-3.5 text-center label-text text-[11px] tracking-[0.15em] transition-all"
            style={{
              backgroundColor: tab === "country" ? "var(--color-accent)" : "transparent",
              color: tab === "country" ? "#000000" : "var(--color-muted)",
              fontWeight: tab === "country" ? 800 : 600,
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
          <div className="flex flex-col items-center py-12 game-card p-8">
            <img
              src="/assets/final/state/empty-ranking.png"
              alt=""
              aria-hidden="true"
              style={{ width: "80px", height: "80px", marginBottom: "16px", opacity: 0.7 }}
            />
            <p className="text-center text-muted text-[13px]">{t("landing.noRankings")}</p>
          </div>
        ) : (
          <div className="pb-8">
            <RankingList title={title} entries={entries} />
          </div>
        )}
      </div>
    </main>
  );
}
