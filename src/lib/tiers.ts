// ============================================================
// Tier System — height-based progression tiers
// ============================================================

export type TierDef = {
  readonly id: string;
  readonly minHeight: number;
  readonly color: string;
};

/**
 * 19-tier progression system.
 * Low tiers (0–1.2m) are closely spaced for early dopamine hits.
 * High tiers (5–10m) are wide gaps reflecting exponential difficulty.
 * Chuunibyou tiers (30m–400km) are symbolic — human arm limit is ~10m,
 * above that requires drones/balloons/rockets.
 * Sorted ascending by minHeight — binary search friendly.
 */
const TIERS: readonly TierDef[] = [
  { id: "rookie",    minHeight: 0,       color: "#666666" },
  { id: "iron",      minHeight: 0.3,     color: "#8A8A8A" },
  { id: "bronze",    minHeight: 0.7,     color: "#CD7F32" },
  { id: "silver",    minHeight: 1.2,     color: "#C0C0C0" },
  { id: "gold",      minHeight: 1.8,     color: "#FFB800" },
  { id: "platinum",  minHeight: 2.5,     color: "#E5E4E2" },
  { id: "emerald",   minHeight: 3.5,     color: "#50C878" },
  { id: "diamond",   minHeight: 5.0,     color: "#B9F2FF" },
  { id: "master",    minHeight: 7.0,     color: "#9B59B6" },
  { id: "legend",      minHeight: 10.0,    color: "#FF2D2D" },
  { id: "grandmaster", minHeight: 13.0,   color: "#E04040" },
  { id: "titan",       minHeight: 16.0,   color: "#D4523A" },
  { id: "apex",        minHeight: 19.0,   color: "#C44D2B" },
  { id: "phantom",     minHeight: 23.0,   color: "#A33DC0" },
  { id: "overlord",    minHeight: 27.0,   color: "#7B2FBE" },
  // --- Chuunibyou tiers (beyond human arm) ---
  { id: "mythic",    minHeight: 30,      color: "#F5DEB3" },
  { id: "stellar",   minHeight: 50,      color: "#FFD700" },
  { id: "celestial", minHeight: 100,     color: "#87CEEB" },
  { id: "cosmic",    minHeight: 500,     color: "#6A5ACD" },
  { id: "galactic",  minHeight: 1000,    color: "#9370DB" },
  { id: "nebula",    minHeight: 5000,    color: "#FF1493" },
  { id: "void",      minHeight: 10000,   color: "#0A0A0A" },
  { id: "karman",    minHeight: 100000,  color: "#00E5FF" },
  { id: "omega",     minHeight: 400000,  color: "#FF4500" },
] as const;

/** Get the tier for a given height (highest tier whose minHeight <= height) */
export function getTierForHeight(height: number): TierDef {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (height >= t.minHeight) {
      tier = t;
    } else {
      break;
    }
  }
  return tier;
}

/** Get the next tier above the current height, or null if already Omega */
export function getNextTier(
  height: number,
): { readonly tier: TierDef; readonly remaining: number } | null {
  for (const t of TIERS) {
    if (t.minHeight > height) {
      return { tier: t, remaining: +(t.minHeight - height).toFixed(2) };
    }
  }
  return null;
}

/**
 * Check if a new height crosses into a higher tier than the previous best.
 * Returns the newly achieved tier, or null if no breakthrough.
 */
export function checkTierBreakthrough(
  previousBest: number,
  newHeight: number,
): TierDef | null {
  if (newHeight <= previousBest) return null;
  const oldTier = getTierForHeight(previousBest);
  const newTier = getTierForHeight(newHeight);
  if (newTier.minHeight > oldTier.minHeight) return newTier;
  return null;
}

/**
 * Near-miss detection.
 * Priority: tier near-miss > PB near-miss.
 *
 * Tier near-miss: within 30% of the gap to next tier.
 * PB near-miss: within 0.15m of personal best (only if not already PB).
 */
export function getNearMissMessage(
  throwHeight: number,
  personalBest: number,
): {
  readonly type: "tier" | "pb";
  readonly remaining: number;
  readonly targetName: string;
} | null {
  // Tier near-miss
  const next = getNextTier(personalBest);
  if (next) {
    const currentTier = getTierForHeight(personalBest);
    const gap = next.tier.minHeight - currentTier.minHeight;
    const threshold = gap * 0.3;
    const remaining = +(next.tier.minHeight - personalBest).toFixed(2);
    if (remaining <= threshold && remaining > 0) {
      return { type: "tier", remaining, targetName: next.tier.id };
    }
  }

  // PB near-miss (only when this throw didn't set a new PB)
  if (throwHeight < personalBest) {
    const pbRemaining = +(personalBest - throwHeight).toFixed(2);
    if (pbRemaining <= 0.15 && pbRemaining > 0) {
      return { type: "pb", remaining: pbRemaining, targetName: "PB" };
    }
  }

  return null;
}

/** All tiers — exposed for ranking list dot colors */
export { TIERS };
