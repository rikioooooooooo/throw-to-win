// ============================================================
// Achievement Detection — determines celebration state
// ============================================================

export const CHUUNI_TIER_IDS = [
  "mythic", "stellar", "celestial", "cosmic", "galactic",
  "nebula", "void", "karman", "omega",
] as const;

/** Badge type — priority: chuuniTier > worldRecord > personalBest > none */
export type BadgeType = "chuuniTier" | "worldRecord" | "personalBest" | null;

/** Cracker intensity level */
export type CrackerLevel = "legendary" | "epic" | "rare" | "none";

/** Detected achievement state — flags for each independent achievement */
export type AchievementState = {
  readonly isWorldRecord: boolean;
  readonly worldTop5Rank: number | null;
  readonly countryTop5Rank: number | null;
  readonly isChuuniTier: boolean;
  readonly chuuniTierId: string | null;
  readonly isPersonalBest: boolean;
  readonly badge: BadgeType;
  readonly crackerLevel: CrackerLevel;
};

export function determineAchievements(opts: {
  readonly worldRank: number | null;
  readonly countryRank: number | null;
  readonly isPersonalBest: boolean;
  readonly tierId: string;
  readonly isBreakthrough: boolean;
}): AchievementState {
  const isWorldRecord = opts.worldRank === 1;

  const worldTop5Rank =
    !isWorldRecord && opts.worldRank !== null && opts.worldRank >= 2 && opts.worldRank <= 5
      ? opts.worldRank
      : null;

  const countryTop5Rank =
    !isWorldRecord && opts.countryRank !== null && opts.countryRank >= 1 && opts.countryRank <= 5
      ? opts.countryRank
      : null;

  const isChuuniTier =
    opts.isBreakthrough && (CHUUNI_TIER_IDS as readonly string[]).includes(opts.tierId);

  const chuuniTierId = isChuuniTier ? opts.tierId : null;

  let badge: BadgeType = null;
  if (isChuuniTier) badge = "chuuniTier";
  else if (isWorldRecord) badge = "worldRecord";
  else if (opts.isPersonalBest) badge = "personalBest";

  let crackerLevel: CrackerLevel = "none";
  if (isWorldRecord) crackerLevel = "legendary";
  else if (worldTop5Rank !== null || countryTop5Rank !== null || isChuuniTier) crackerLevel = "epic";
  else if (opts.isPersonalBest) crackerLevel = "rare";

  return {
    isWorldRecord,
    worldTop5Rank,
    countryTop5Rank,
    isChuuniTier,
    chuuniTierId,
    isPersonalBest: opts.isPersonalBest,
    badge,
    crackerLevel,
  };
}
