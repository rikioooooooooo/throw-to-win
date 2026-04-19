"use client";

import { useTranslations } from "next-intl";

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
  if (!code || code.length !== 2 || code === "XX") return "";
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    upper.charCodeAt(0) + 0x1f1a5,
    upper.charCodeAt(1) + 0x1f1a5,
  );
}

const TOTAL_COUNTRIES = 195;

export function WorldMap({ countries }: WorldMapProps) {
  const t = useTranslations("mypage");

  const activeCount = countries.length;
  const progressPercent = Math.min(100, (activeCount / TOTAL_COUNTRIES) * 100);

  return (
    <div className="animate-fade-in-up">
      {/* Counter + progress */}
      <div className="game-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p
            className="label-text text-[11px] tracking-[0.2em] uppercase"
            style={{ color: "var(--color-accent)" }}
          >
            {activeCount} / {TOTAL_COUNTRIES}
          </p>
        </div>
        {/* Progress bar */}
        <div
          className="w-full h-[6px] overflow-hidden"
          style={{
            backgroundColor: "rgba(0, 250, 154, 0.06)",
            borderRadius: "3px",
          }}
        >
          <div
            className="h-full transition-all duration-700 ease-out"
            style={{
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #00fa9a 0%, #00e08a 100%)",
              borderRadius: "3px",
            }}
          />
        </div>

        {/* Country flags grid */}
        {activeCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {countries.map((entry) => {
              const flag = countryFlag(entry.country);
              if (!flag) return null;
              return (
                <span
                  key={entry.country}
                  className="text-[24px]"
                  title={`${entry.country}: ${entry.throws} ${t("throwsCount")}, ${entry.players} ${t("playersCount")}`}
                >
                  {flag}
                </span>
              );
            })}
          </div>
        )}

        {activeCount === 0 && (
          <p className="text-muted/40 text-[12px] mt-3 text-center">
            {t("noThrows")}
          </p>
        )}
      </div>
    </div>
  );
}
