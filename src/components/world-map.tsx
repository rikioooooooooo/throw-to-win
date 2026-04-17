"use client";

import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { formatHeight } from "@/lib/physics";

type CountryEntry = {
  readonly country: string;
  readonly throws: number;
  readonly players: number;
  readonly best: number;
};

type WorldMapProps = {
  readonly countries: readonly CountryEntry[];
};

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return code;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    upper.charCodeAt(0) + 0x1f1a5,
    upper.charCodeAt(1) + 0x1f1a5,
  );
}

function getCountryName(code: string, locale: string): string {
  try {
    const regionNames = new Intl.DisplayNames([locale], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const TOTAL_COUNTRIES = 195;

export function WorldMap({ countries }: WorldMapProps) {
  const t = useTranslations("mypage");
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  const activeCount = countries.length;
  const progressPercent = Math.min(100, (activeCount / TOTAL_COUNTRIES) * 100);

  return (
    <div className="animate-fade-in-up">
      {/* Summary header */}
      <div
        className="p-5 mb-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(0, 250, 154, 0.04) 0%, transparent 60%) var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "16px",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p
            className="label-text text-[11px] tracking-[0.2em] uppercase"
            style={{ color: "var(--color-accent)" }}
          >
            {t("countriesActive", { count: activeCount })}
          </p>
          <span className="text-[12px] text-muted/60">
            / {TOTAL_COUNTRIES}
          </span>
        </div>
        {/* Progress bar */}
        <div
          className="w-full h-[6px] overflow-hidden"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderRadius: "3px",
          }}
        >
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background:
                "linear-gradient(90deg, #00fa9a 0%, #00e08a 100%)",
              borderRadius: "3px",
            }}
          />
        </div>
      </div>

      {/* Country grid */}
      {countries.length === 0 ? (
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {countries.map((entry, index) => (
            <div
              key={entry.country}
              className="flex items-center gap-3 p-4"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "12px",
                opacity: 0,
                animation: `fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 40}ms forwards`,
              }}
            >
              {/* Flag + name */}
              <span className="text-[20px] flex-shrink-0">
                {countryFlag(entry.country)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">
                  {getCountryName(entry.country, locale)}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-muted/70">
                    {entry.throws} {t("throwsCount")}
                  </span>
                  <span className="text-[11px] text-muted/50">
                    {entry.players} {t("playersCount")}
                  </span>
                </div>
              </div>
              {/* Best height */}
              <div className="flex-shrink-0 text-right">
                <span className="height-number text-[16px] text-foreground">
                  {formatHeight(entry.best)}
                </span>
                <span className="text-[11px] text-muted ml-0.5">m</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
