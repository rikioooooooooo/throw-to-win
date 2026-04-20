"use client";

import { useState } from "react";
import { CrackerParticles } from "@/components/cracker-particles";
import { TierIcon } from "@/components/tier-icon";
import { determineAchievements, type CrackerLevel, type AchievementState } from "@/lib/achievements";

type Scenario = {
  readonly label: string;
  readonly worldRank: number | null;
  readonly countryRank: number | null;
  readonly country: string;
  readonly isPersonalBest: boolean;
  readonly tierId: string;
  readonly isBreakthrough: boolean;
};

const SCENARIOS: readonly Scenario[] = [
  {
    label: "WR + Country #1 + Chuuni + PB",
    worldRank: 1,
    countryRank: 1,
    country: "JP",
    isPersonalBest: true,
    tierId: "mythic",
    isBreakthrough: true,
  },
  {
    label: "World #3 + Country #2 + PB",
    worldRank: 3,
    countryRank: 2,
    country: "US",
    isPersonalBest: true,
    tierId: "diamond",
    isBreakthrough: false,
  },
  {
    label: "Country #4 + Chuuni + PB",
    worldRank: 42,
    countryRank: 4,
    country: "KR",
    isPersonalBest: true,
    tierId: "stellar",
    isBreakthrough: true,
  },
  {
    label: "World #5 only (no PB)",
    worldRank: 5,
    countryRank: 8,
    country: "FR",
    isPersonalBest: false,
    tierId: "platinum",
    isBreakthrough: false,
  },
  {
    label: "Chuuni tier only (no top5)",
    worldRank: 50,
    countryRank: 20,
    country: "DE",
    isPersonalBest: true,
    tierId: "celestial",
    isBreakthrough: true,
  },
  {
    label: "Personal Best only",
    worldRank: 500,
    countryRank: 120,
    country: "JP",
    isPersonalBest: true,
    tierId: "gold",
    isBreakthrough: false,
  },
  {
    label: "Country unknown (XX)",
    worldRank: 4,
    countryRank: 1,
    country: "XX",
    isPersonalBest: true,
    tierId: "diamond",
    isBreakthrough: false,
  },
  {
    label: "Normal throw (no achievement)",
    worldRank: 800,
    countryRank: 200,
    country: "JP",
    isPersonalBest: false,
    tierId: "silver",
    isBreakthrough: false,
  },
];

const CRACKER_LEVELS: readonly CrackerLevel[] = [
  "legendary",
  "epic",
  "rare",
  "none",
];

export default function DebugPage() {
  const [activeLevel, setActiveLevel] = useState<CrackerLevel>("none");
  const [crackerActive, setCrackerActive] = useState(false);
  const [achievementResult, setAchievementResult] =
    useState<AchievementState | null>(null);
  const [activeTierId, setActiveTierId] = useState<string>("");
  const [activeCountry, setActiveCountry] = useState<string>("");
  const triggerCracker = (level: CrackerLevel) => {
    setCrackerActive(false);
    setActiveLevel("none");
    // Reset then trigger on next frame
    requestAnimationFrame(() => {
      setActiveLevel(level);
      setCrackerActive(true);
    });
  };

  const testScenario = (scenario: Scenario) => {
    const result = determineAchievements({
      worldRank: scenario.worldRank,
      countryRank: scenario.countryRank,
      isPersonalBest: scenario.isPersonalBest,
      tierId: scenario.tierId,
      isBreakthrough: scenario.isBreakthrough,
    });
    setAchievementResult(result);
    setActiveTierId(scenario.tierId);
    setActiveCountry(scenario.country);
    triggerCracker(result.crackerLevel);
  };

  return (
    <main className="min-h-screen bg-background text-foreground p-6 max-w-lg mx-auto">
      <h1 className="text-[20px] font-bold tracking-wider mb-6">
        Achievement Debug
      </h1>

      {/* Cracker level buttons */}
      <section className="mb-8">
        <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3">
          Cracker Particles
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {CRACKER_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => triggerCracker(level)}
              className="py-3 text-[13px] tracking-wider uppercase active:scale-[0.97] transition-all game-border"
              style={{
                color:
                  level === "legendary"
                    ? "#FFD700"
                    : level === "epic"
                      ? "#9B59B6"
                      : level === "rare"
                        ? "#00FA9A"
                        : "var(--color-muted)",
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </section>

      {/* Scenario buttons */}
      <section className="mb-8">
        <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3">
          Achievement Scenarios
        </h2>
        <div className="flex flex-col gap-2">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.label}
              onClick={() => testScenario(scenario)}
              className="py-3 px-4 text-left text-[13px] tracking-wider active:scale-[0.98] transition-all game-border"
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </section>

      {/* Badge + Result display */}
      {achievementResult && (() => {
        const wr = achievementResult.isWorldRecord;
        const w5 = achievementResult.worldTop5Rank;
        const c5 = achievementResult.countryTop5Rank;
        const debugGlow = wr
          ? { badgeShadow: "drop-shadow(0 0 20px rgba(255,215,0,0.5)) drop-shadow(0 0 40px rgba(255,45,45,0.3))", textClass: "rank-glow-wr" }
          : w5 === 2 ? { badgeShadow: "drop-shadow(0 0 16px rgba(255,215,0,0.4))", textClass: "rank-glow-gold" }
          : w5 === 3 ? { badgeShadow: "drop-shadow(0 0 12px rgba(192,192,192,0.4))", textClass: "rank-glow-silver" }
          : w5 === 4 ? { badgeShadow: "drop-shadow(0 0 10px rgba(205,127,50,0.3))", textClass: "rank-glow-bronze" }
          : w5 === 5 ? { badgeShadow: "drop-shadow(0 0 8px rgba(0,250,154,0.3))", textClass: "rank-glow-accent" }
          : c5 === 1 ? { badgeShadow: "drop-shadow(0 0 14px rgba(0,250,154,0.4))", textClass: "rank-glow-country1" }
          : c5 === 2 ? { badgeShadow: "drop-shadow(0 0 10px rgba(0,250,154,0.3))", textClass: "rank-glow-accent" }
          : c5 === 3 ? { badgeShadow: "drop-shadow(0 0 8px rgba(0,200,180,0.3))", textClass: "rank-glow-teal" }
          : c5 === 4 ? { badgeShadow: "drop-shadow(0 0 6px rgba(0,250,154,0.2))", textClass: "" }
          : c5 === 5 ? { badgeShadow: "", textClass: "" }
          : { badgeShadow: "", textClass: "" };

        return (
        <section className="game-card p-4">
          <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3">
            Badge Preview
          </h2>
          <div className="flex flex-col items-center py-6">
            {achievementResult.badge === "chuuniTier" && (
              <div className="flex flex-col items-center">
                <div style={{ filter: debugGlow.badgeShadow || undefined }}>
                  <TierIcon tierId={activeTierId} size={140} />
                </div>
              </div>
            )}
            {achievementResult.badge === "worldRecord" && (
              <div className="flex flex-col items-center">
                <img
                  src="/assets/final/achievement/wr-update.png"
                  alt=""
                  style={{ width: "180px", height: "101px", objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both", filter: debugGlow.badgeShadow || undefined }}
                />
              </div>
            )}
            {achievementResult.badge === "personalBest" && (
              <div className="flex flex-col items-center">
                <img
                  src="/assets/final/achievement/pb-update.png"
                  alt=""
                  style={{ width: "180px", height: "101px", objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both", filter: debugGlow.badgeShadow || undefined }}
                />
              </div>
            )}
            {achievementResult.badge === null && (
              <p className="text-muted/40 text-[13px]">No achievement</p>
            )}
            {(() => {
              const parts: string[] = [];
              if (achievementResult.isWorldRecord) parts.push("WORLD RECORD");
              if (achievementResult.worldTop5Rank !== null) parts.push(`\u{1F30D} #${achievementResult.worldTop5Rank}`);
              if (achievementResult.countryTop5Rank !== null) {
                const cc = activeCountry.toUpperCase();
                const flag = cc.length === 2 && cc !== "XX"
                  ? String.fromCodePoint(cc.charCodeAt(0) + 0x1f1a5, cc.charCodeAt(1) + 0x1f1a5)
                  : "\u{1F3F3}\u{FE0F}";
                parts.push(`${flag} #${achievementResult.countryTop5Rank}`);
              }
              if (achievementResult.isChuuniTier && achievementResult.chuuniTierId) {
                parts.push(`${achievementResult.chuuniTierId.toUpperCase()} UNLOCKED`);
              }
              if (achievementResult.isPersonalBest && !achievementResult.isWorldRecord && !achievementResult.isChuuniTier) {
                parts.push("PERSONAL BEST");
              }
              if (parts.length === 0) return null;
              return (
                <p className={`achievement-badge label-text text-[14px] tracking-[0.2em] mt-3 text-accent text-center whitespace-normal ${debugGlow.textClass}`}>
                  {parts.join(" / ")}
                </p>
              );
            })()}
          </div>
          <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3 mt-4">
            Raw Result
          </h2>
          <pre className="text-[11px] text-foreground/60 whitespace-pre-wrap">
            {JSON.stringify(achievementResult, null, 2)}
          </pre>
        </section>
        );
      })()}

      <CrackerParticles level={activeLevel} active={crackerActive} />
    </main>
  );
}
