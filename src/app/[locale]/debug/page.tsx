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
  // === World rankings ===
  { label: "🌍 World #1 (WR)", worldRank: 1, countryRank: 1, country: "JP", isPersonalBest: true, tierId: "legend", isBreakthrough: true },
  { label: "🌍 World #2", worldRank: 2, countryRank: 1, country: "US", isPersonalBest: true, tierId: "master", isBreakthrough: true },
  { label: "🌍 World #3", worldRank: 3, countryRank: 2, country: "KR", isPersonalBest: true, tierId: "diamond", isBreakthrough: true },
  { label: "🌍 World #4", worldRank: 4, countryRank: 3, country: "FR", isPersonalBest: true, tierId: "emerald", isBreakthrough: true },
  { label: "🌍 World #5", worldRank: 5, countryRank: 4, country: "DE", isPersonalBest: true, tierId: "platinum", isBreakthrough: true },
  // === Country rankings ===
  { label: "🏴 Country #1", worldRank: 20, countryRank: 1, country: "JP", isPersonalBest: true, tierId: "diamond", isBreakthrough: true },
  { label: "🏴 Country #2", worldRank: 35, countryRank: 2, country: "US", isPersonalBest: true, tierId: "emerald", isBreakthrough: true },
  { label: "🏴 Country #3", worldRank: 50, countryRank: 3, country: "KR", isPersonalBest: true, tierId: "gold", isBreakthrough: true },
  { label: "🏴 Country #4", worldRank: 70, countryRank: 4, country: "TW", isPersonalBest: true, tierId: "silver", isBreakthrough: true },
  { label: "🏴 Country #5", worldRank: 90, countryRank: 5, country: "GB", isPersonalBest: true, tierId: "bronze", isBreakthrough: true },
  // === Special ===
  { label: "⚡ Chuuni (Mythic) + WR", worldRank: 1, countryRank: 1, country: "JP", isPersonalBest: true, tierId: "mythic", isBreakthrough: true },
  { label: "⚡ Chuuni (Celestial) only", worldRank: 50, countryRank: 20, country: "DE", isPersonalBest: true, tierId: "celestial", isBreakthrough: true },
  { label: "⭐ PB only", worldRank: 500, countryRank: 120, country: "JP", isPersonalBest: true, tierId: "gold", isBreakthrough: true },
  { label: "— Normal (no achievement)", worldRank: 800, countryRank: 200, country: "JP", isPersonalBest: false, tierId: "silver", isBreakthrough: false },
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

      {/* Full-screen result preview overlay */}
      {achievementResult && (() => {
        const wr = achievementResult.isWorldRecord;
        const w5 = achievementResult.worldTop5Rank;
        const c5 = achievementResult.countryTop5Rank;
        const g = wr
          ? { hs: "0 0 60px rgba(255,215,0,0.8), 0 0 120px rgba(255,45,45,0.4), 0 0 180px rgba(59,130,246,0.3)", bg: "radial-gradient(circle, rgba(255,215,0,0.4) 0%, rgba(255,45,45,0.2) 40%, transparent 70%)", tc: "rank-glow-wr", cg: "inset 0 0 60px rgba(255,215,0,0.15), inset 0 0 120px rgba(255,45,45,0.08)" }
          : w5 === 2 ? { hs: "0 0 50px rgba(255,215,0,0.7), 0 0 100px rgba(255,215,0,0.3)", bg: "radial-gradient(circle, rgba(255,215,0,0.35) 0%, transparent 65%)", tc: "rank-glow-gold", cg: "inset 0 0 50px rgba(255,215,0,0.12)" }
          : w5 === 3 ? { hs: "0 0 40px rgba(192,192,192,0.7), 0 0 80px rgba(192,192,192,0.3)", bg: "radial-gradient(circle, rgba(192,192,192,0.3) 0%, transparent 65%)", tc: "rank-glow-silver", cg: "inset 0 0 40px rgba(192,192,192,0.1)" }
          : w5 === 4 ? { hs: "0 0 30px rgba(205,127,50,0.6)", bg: "radial-gradient(circle, rgba(205,127,50,0.25) 0%, transparent 65%)", tc: "rank-glow-bronze", cg: "inset 0 0 30px rgba(205,127,50,0.08)" }
          : w5 === 5 ? { hs: "0 0 25px rgba(0,250,154,0.5)", bg: "radial-gradient(circle, rgba(0,250,154,0.2) 0%, transparent 65%)", tc: "rank-glow-accent", cg: "inset 0 0 25px rgba(0,250,154,0.06)" }
          : c5 === 1 ? { hs: "0 0 45px rgba(0,250,154,0.7), 0 0 90px rgba(0,250,154,0.3)", bg: "radial-gradient(circle, rgba(0,250,154,0.3) 0%, transparent 65%)", tc: "rank-glow-country1", cg: "inset 0 0 40px rgba(0,250,154,0.1)" }
          : c5 === 2 ? { hs: "0 0 35px rgba(0,250,154,0.6)", bg: "radial-gradient(circle, rgba(0,250,154,0.25) 0%, transparent 65%)", tc: "rank-glow-accent", cg: "inset 0 0 30px rgba(0,250,154,0.08)" }
          : c5 === 3 ? { hs: "0 0 25px rgba(0,200,180,0.5)", bg: "radial-gradient(circle, rgba(0,200,180,0.2) 0%, transparent 65%)", tc: "rank-glow-teal", cg: "inset 0 0 20px rgba(0,200,180,0.06)" }
          : c5 === 4 ? { hs: "0 0 20px rgba(0,250,154,0.4)", bg: "radial-gradient(circle, rgba(0,250,154,0.15) 0%, transparent 65%)", tc: "", cg: "" }
          : c5 === 5 ? { hs: "0 0 15px rgba(0,250,154,0.3)", bg: "", tc: "", cg: "" }
          : { hs: "", bg: "", tc: "", cg: "" };

        const statusParts: string[] = [];
        if (achievementResult.isWorldRecord) statusParts.push("WORLD RECORD");
        if (achievementResult.worldTop5Rank !== null) statusParts.push(`\u{1F30D} #${achievementResult.worldTop5Rank}`);
        if (achievementResult.countryTop5Rank !== null) {
          const cc = activeCountry.toUpperCase();
          const flag = cc.length === 2 && cc !== "XX" ? String.fromCodePoint(cc.charCodeAt(0) + 0x1f1a5, cc.charCodeAt(1) + 0x1f1a5) : "\u{1F3F3}\u{FE0F}";
          statusParts.push(`${flag} #${achievementResult.countryTop5Rank}`);
        }
        if (achievementResult.isChuuniTier && achievementResult.chuuniTierId) statusParts.push(`${achievementResult.chuuniTierId.toUpperCase()} UNLOCKED`);
        if (achievementResult.isPersonalBest && !achievementResult.isWorldRecord && !achievementResult.isChuuniTier) statusParts.push("PERSONAL BEST");

        return (
        <div className="fixed inset-0 z-30 bg-background flex flex-col items-center justify-center" style={{ boxShadow: g.cg || undefined }} onClick={() => setAchievementResult(null)}>
          {/* Badge with radial glow */}
          <div className="relative mb-4">
            {g.bg && <div className="absolute inset-0 rounded-full" style={{ background: g.bg, transform: "scale(3)" }} aria-hidden="true" />}
            {achievementResult.badge === "chuuniTier" && (
              <div className="relative"><TierIcon tierId={activeTierId} size={100} /></div>
            )}
            {achievementResult.badge === "worldRecord" && (
              <img className="relative" src="/assets/final/achievement/wr-update.png" alt="" style={{ width: 160, height: 90, objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }} />
            )}
            {achievementResult.badge === "personalBest" && (
              <img className="relative" src="/assets/final/achievement/pb-update.png" alt="" style={{ width: 160, height: 90, objectFit: "contain", animation: "achievement-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" }} />
            )}
          </div>
          {/* Height */}
          <div className="flex items-baseline justify-center mb-2">
            <span className="height-number leading-none" style={{ fontSize: "clamp(4rem, 25vw, 7rem)", color: "var(--color-accent)", textShadow: g.hs || "0 0 30px currentColor" }}>3.42</span>
            <span className="text-[20px] text-muted/60 ml-1">m</span>
          </div>
          {/* Status text */}
          {statusParts.length > 0 && (
            <p className={`achievement-badge label-text text-[14px] tracking-[0.15em] text-accent text-center whitespace-normal mt-2 ${g.tc}`}>
              {statusParts.join(" / ")}
            </p>
          )}
          {/* Tap to close hint */}
          <p className="text-muted/20 text-[11px] mt-8">tap to close</p>
        </div>
        );
      })()}

      <CrackerParticles level={activeLevel} active={crackerActive} />
    </main>
  );
}
