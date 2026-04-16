// ============================================================
// Throw physics — height from airtime
// ============================================================

export const GRAVITY = 9.81; // m/s²

/**
 * Calculate max height from total airtime.
 * h = g * t² / 8
 * (symmetric throw: half the time going up, half coming down)
 */
export function calculateHeight(airtimeSeconds: number): number {
  if (airtimeSeconds <= 0) return 0;
  return (GRAVITY * airtimeSeconds * airtimeSeconds) / 8;
}

/**
 * Max height from initial upward velocity.
 * h = v₀² / (2g) — independent of where the phone is caught.
 */
export function calculateHeightFromV0(v0: number): number {
  if (v0 <= 0) return 0;
  return (v0 * v0) / (2 * GRAVITY);
}

/**
 * Final score height combining airtime-based and v₀-based estimates.
 *
 * Both estimates systematically overestimate:
 *   - h_airtime overshoots when catch is lower than release (asymmetric throw)
 *   - h_v0 overshoots because scalar integration of |a| captures tangential
 *     components (~15-30% overestimate typical)
 *
 * Taking min() gives the tighter upper bound, provably closer to truth.
 *
 * V0_MARGIN provides a safety margin for edge cases where v₀ is
 * underestimated (e.g. first launch sample missed at low sensor rate).
 */
export function calculateScoreHeight(
  airtimeSeconds: number,
  estimatedV0: number,
): number {
  const timeBased = calculateHeight(airtimeSeconds);
  if (estimatedV0 <= 0) return timeBased;
  const V0_MARGIN = 1.15;
  const v0Cap = calculateHeightFromV0(estimatedV0) * V0_MARGIN;
  return Math.min(timeBased, v0Cap);
}

/**
 * Estimate the peak time (midpoint of freefall).
 */
export function estimatePeakTime(
  freefallStart: number,
  landingTime: number,
): number {
  return freefallStart + (landingTime - freefallStart) / 2;
}

/**
 * Format height to 2 decimal places.
 */
export function formatHeight(meters: number): string {
  return meters.toFixed(2);
}

/**
 * Format airtime to 2 decimal places.
 */
export function formatAirtime(seconds: number): string {
  return seconds.toFixed(2);
}
