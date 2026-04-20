// ============================================================
// Achievement Detection — determines celebration level
// ============================================================

/**
 * Chuunibyou tiers (beyond human arm throw ~10m).
 * Reaching any of these is a major milestone worthy of special celebration.
 */
export const CHUUNI_TIER_IDS = [
  "mythic",
  "stellar",
  "celestial",
  "cosmic",
  "galactic",
  "nebula",
  "void",
  "karman",
  "omega",
] as const;

export type AchievementType =
  | "worldRecord"
  | "countryTop5"
  | "chuuniTier"
  | "personalBest"
  | null;

export type CrackerLevel = "legendary" | "epic" | "rare" | "none";

export type AchievementState = {
  readonly type: AchievementType;
  readonly crackerLevel: CrackerLevel;
  /** Chuunibyou tier id if type === "chuuniTier" */
  readonly chuuniTierId: string | null;
};

/**
 * Determine which achievements apply to this throw.
 * Priority (highest wins): WR > country top 5 > chuuni tier > PB.
 */
export function determineAchievements(opts: {
  readonly worldRank: number | null;
  readonly countryRank: number | null;
  readonly isPersonalBest: boolean;
  readonly tierId: string;
  readonly isBreakthrough: boolean;
  readonly previousBest: number;
}): AchievementState {
  // World Record
  if (opts.worldRank === 1) {
    return { type: "worldRecord", crackerLevel: "legendary", chuuniTierId: null };
  }

  // Country Top 5
  if (opts.countryRank !== null && opts.countryRank >= 1 && opts.countryRank <= 5) {
    return { type: "countryTop5", crackerLevel: "epic", chuuniTierId: null };
  }

  // Chuunibyou tier breakthrough
  if (
    opts.isBreakthrough &&
    (CHUUNI_TIER_IDS as readonly string[]).includes(opts.tierId)
  ) {
    return { type: "chuuniTier", crackerLevel: "epic", chuuniTierId: opts.tierId };
  }

  // Personal best
  if (opts.isPersonalBest) {
    return { type: "personalBest", crackerLevel: "rare", chuuniTierId: null };
  }

  return { type: null, crackerLevel: "none", chuuniTierId: null };
}
