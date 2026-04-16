"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { RankingList, type RankEntry } from "@/components/ranking-list";

type Tab = "world" | "country";

export default function RankingPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>("world");
  const [worldEntries, setWorldEntries] = useState<readonly RankEntry[]>([]);
  const [countryEntries, setCountryEntries] = useState<readonly RankEntry[]>([]);
  const [yourCountry, setYourCountry] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const worldRes = await fetch("/api/ranking?scope=world&limit=100");
        if (!worldRes.ok) return;
        const worldData = await worldRes.json() as {
          rankings: RankEntry[];
          yourCountry: string;
        };
        if (cancelled) return;

        setWorldEntries(worldData.rankings);
        setYourCountry(worldData.yourCountry);

        if (worldData.yourCountry && worldData.yourCountry !== "XX") {
          const countryRes = await fetch(
            `/api/ranking?scope=country&country=${worldData.yourCountry}&limit=100`,
          );
          if (countryRes.ok) {
            const countryData = await countryRes.json() as { rankings: RankEntry[] };
            if (!cancelled) setCountryEntries(countryData.rankings);
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const entries = tab === "world" ? worldEntries : countryEntries;
  const title = tab === "world" ? t("landing.worldRanking") : t("landing.countryRanking");

  return (
    <main className="min-h-screen bg-background px-5 safe-top safe-bottom">
      <header className="flex items-center justify-between pt-4 mb-6">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="label-text text-[11px] text-muted hover:text-foreground transition-colors px-4 py-2 active:scale-[0.97]"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
        >
          {t("ranking.back")}
        </button>
        <h1 className="label-text text-[12px] tracking-[0.2em] text-foreground uppercase">
          {t("ranking.heading")}
        </h1>
        <div className="w-[60px]" />
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
          className="flex-1 py-3 text-center label-text text-[11px] tracking-[0.15em] transition-colors"
          style={{
            backgroundColor: tab === "world" ? "var(--color-accent)" : "transparent",
            color: tab === "world" ? "#ffffff" : "var(--color-muted)",
          }}
        >
          {t("ranking.world")}
        </button>
        <button
          onClick={() => setTab("country")}
          className="flex-1 py-3 text-center label-text text-[11px] tracking-[0.15em] transition-colors"
          style={{
            backgroundColor: tab === "country" ? "var(--color-accent)" : "transparent",
            color: tab === "country" ? "#ffffff" : "var(--color-muted)",
          }}
        >
          {t("ranking.country")}
          {yourCountry && yourCountry !== "XX" && (
            <span className="ml-1 text-[9px] opacity-60">({yourCountry})</span>
          )}
        </button>
      </div>

      {loading ? (
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
