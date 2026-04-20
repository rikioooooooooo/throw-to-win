"use client";

import { useState } from "react";
import { CrackerParticles } from "@/components/cracker-particles";
import { TierIcon } from "@/components/tier-icon";
import { determineAchievements, type CrackerLevel, type AchievementState } from "@/lib/achievements";

type Scenario = {
  readonly label: string;
  readonly worldRank: number | null;
  readonly countryRank: number | null;
  readonly isPersonalBest: boolean;
  readonly tierId: string;
  readonly isBreakthrough: boolean;
  readonly previousBest: number;
};

const SCENARIOS: readonly Scenario[] = [
  {
    label: "World Record (#1)",
    worldRank: 1,
    countryRank: 1,
    isPersonalBest: true,
    tierId: "legend",
    isBreakthrough: true,
    previousBest: 8.0,
  },
  {
    label: "Country Top 5 (#3)",
    worldRank: 42,
    countryRank: 3,
    isPersonalBest: true,
    tierId: "diamond",
    isBreakthrough: false,
    previousBest: 4.5,
  },
  {
    label: "Chuuni Tier (Mythic)",
    worldRank: 10,
    countryRank: 8,
    isPersonalBest: true,
    tierId: "mythic",
    isBreakthrough: true,
    previousBest: 25.0,
  },
  {
    label: "Personal Best",
    worldRank: 500,
    countryRank: 120,
    isPersonalBest: true,
    tierId: "gold",
    isBreakthrough: false,
    previousBest: 1.5,
  },
  {
    label: "Normal throw (no achievement)",
    worldRank: 800,
    countryRank: 200,
    isPersonalBest: false,
    tierId: "silver",
    isBreakthrough: false,
    previousBest: 2.0,
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
      previousBest: scenario.previousBest,
    });
    setAchievementResult(result);
    setActiveTierId(scenario.tierId);
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
      {achievementResult && (
        <section className="game-card p-4">
          <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3">
            Badge Preview
          </h2>
          <div className="flex flex-col items-center py-6">
            {achievementResult.type === "chuuniTier" && (
              <div className="flex flex-col items-center">
                <TierIcon tierId={activeTierId} size={140} />
                <p className="achievement-badge label-text text-[14px] tracking-[0.2em] mt-3 text-accent">
                  {activeTierId.toUpperCase()} UNLOCKED
                </p>
              </div>
            )}
            {achievementResult.type === "worldRecord" && (
              <div className="flex flex-col items-center">
                <img
                  src="/assets/final/achievement/wr-update.png"
                  alt=""
                  style={{ width: "180px", height: "101px", objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
                />
                <p className="achievement-badge label-text text-[14px] tracking-[0.2em] mt-3 text-[#FFD700]">
                  WORLD RECORD
                </p>
              </div>
            )}
            {achievementResult.type === "countryTop5" && (
              <div className="flex flex-col items-center">
                <img
                  src="/assets/final/achievement/pb-update.png"
                  alt=""
                  style={{ width: "180px", height: "101px", objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
                />
                <p className="achievement-badge label-text text-[14px] tracking-[0.2em] mt-3 text-accent">
                  COUNTRY TOP 5
                </p>
              </div>
            )}
            {achievementResult.type === "personalBest" && (
              <div className="flex flex-col items-center">
                <img
                  src="/assets/final/achievement/pb-update.png"
                  alt=""
                  style={{ width: "180px", height: "101px", objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
                />
                <p className="achievement-badge label-text text-[14px] tracking-[0.2em] mt-3 text-accent">
                  PERSONAL BEST
                </p>
              </div>
            )}
            {achievementResult.type === null && (
              <p className="text-muted/40 text-[13px]">No achievement</p>
            )}
          </div>
          <h2 className="text-[14px] text-muted/60 tracking-widest uppercase mb-3 mt-4">
            Raw Result
          </h2>
          <pre className="text-[11px] text-foreground/60 whitespace-pre-wrap">
            {JSON.stringify(achievementResult, null, 2)}
          </pre>
        </section>
      )}

      <CrackerParticles level={activeLevel} active={crackerActive} />
    </main>
  );
}
