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
