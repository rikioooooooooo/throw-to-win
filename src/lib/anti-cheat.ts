import type { AccelSample } from "./types";

const GRAVITY = 9.81;
const MIN_SAMPLE_RATE_HZ = 40;
const MAX_DT_COEFFICIENT_OF_VARIATION = 0.6;
const CALIBRATION_MAGNITUDE_MIN = 8.5;
const CALIBRATION_MAGNITUDE_MAX = 11.0;
const LAUNCH_MAGNITUDE_THRESHOLD = 15;
const FREEFALL_MAGNITUDE_THRESHOLD = 8.0; // matches sensor.ts FREEFALL_THRESHOLD
const LANDING_MAGNITUDE_THRESHOLD = 12; // matches sensor.ts LANDING_THRESHOLD
const MIN_FREEFALL_SAMPLES = 3;
const RELATIVE_DEVIATION_THRESHOLD = 0.15; // 15% relative deviation allowed
const NOISE_STD_MIN = 0.01;
const NOISE_STD_MAX = 0.5;

type CheckResult = {
  readonly name: string;
  readonly passed: boolean;
  readonly score: number;
  readonly detail: string;
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - avg) * (v - avg), 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

function checkSampleCount(
  samples: readonly AccelSample[],
  airtimeSeconds: number,
): CheckResult {
  const expectedMin = Math.floor(MIN_SAMPLE_RATE_HZ * airtimeSeconds * 0.5);
  const passed = samples.length >= expectedMin;
  return {
    name: "sample_count",
    passed,
    score: passed ? 0 : 0.3,
    detail: `count=${samples.length} expected>=${expectedMin}`,
  };
}

function checkSampleIntervalRegularity(
  samples: readonly AccelSample[],
): CheckResult {
  if (samples.length < 3) {
    return {
      name: "interval_regularity",
      passed: false,
      score: 0.2,
      detail: "insufficient samples",
    };
  }

  const intervals: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    intervals.push(samples[i].t - samples[i - 1].t);
  }

  const avg = mean(intervals);
  if (avg === 0) {
    return {
      name: "interval_regularity",
      passed: false,
      score: 0.4,
      detail: "zero average interval",
    };
  }

  const cv = stdDev(intervals) / avg;
  const passed = cv < MAX_DT_COEFFICIENT_OF_VARIATION;
  return {
    name: "interval_regularity",
    passed,
    score: passed ? 0 : Math.min(0.3, cv * 0.3),
    detail: `cv=${cv.toFixed(3)}`,
  };
}

function checkCalibrationBaseline(
  samples: readonly AccelSample[],
): CheckResult {
  const first10 = samples.slice(0, Math.min(10, samples.length));
  if (first10.length === 0) {
    return {
      name: "calibration_baseline",
      passed: false,
      score: 0.2,
      detail: "no samples",
    };
  }

  const avgMag = mean(first10.map((s) => s.magnitude));
  const passed =
    avgMag >= CALIBRATION_MAGNITUDE_MIN && avgMag <= CALIBRATION_MAGNITUDE_MAX;
  return {
    name: "calibration_baseline",
    passed,
    score: passed ? 0 : 0.2,
    detail: `baseline=${avgMag.toFixed(2)}`,
  };
}

function checkLaunchSpike(samples: readonly AccelSample[]): CheckResult {
  const hasSpike = samples.some(
    (s) => s.magnitude > LAUNCH_MAGNITUDE_THRESHOLD,
  );
  return {
    name: "launch_spike",
    passed: hasSpike,
    score: hasSpike ? 0 : 0.3,
    detail: hasSpike ? "detected" : "missing",
  };
}

function checkFreefallPresence(samples: readonly AccelSample[]): CheckResult {
  let consecutiveFreefall = 0;
  let maxConsecutive = 0;

  for (const sample of samples) {
    if (sample.magnitude < FREEFALL_MAGNITUDE_THRESHOLD) {
      consecutiveFreefall++;
      maxConsecutive = Math.max(maxConsecutive, consecutiveFreefall);
    } else {
      consecutiveFreefall = 0;
    }
  }

  const passed = maxConsecutive >= MIN_FREEFALL_SAMPLES;
  return {
    name: "freefall_presence",
    passed,
    score: passed ? 0 : 0.3,
    detail: `max_consecutive=${maxConsecutive}`,
  };
}

function checkLandingSpike(samples: readonly AccelSample[]): CheckResult {
  let foundFreefall = false;
  let hasLandingSpike = false;

  for (const sample of samples) {
    if (sample.magnitude < FREEFALL_MAGNITUDE_THRESHOLD) {
      foundFreefall = true;
    }
    if (foundFreefall && sample.magnitude > LANDING_MAGNITUDE_THRESHOLD) {
      hasLandingSpike = true;
      break;
    }
  }

  return {
    name: "landing_spike",
    passed: hasLandingSpike,
    score: hasLandingSpike ? 0 : 0.15,
    detail: hasLandingSpike ? "detected" : "missing",
  };
}

/** Server-side mirror of sensor.ts::computeV0FromLaunch */
function estimateV0FromSamples(
  samples: readonly AccelSample[],
  freefallStartT: number,
): number {
  const LAUNCH_ACCEL_THRESHOLD = 12;

  // Find calibration region: samples before the first high-magnitude launch spike
  let launchIdx = samples.length;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].magnitude > LAUNCH_ACCEL_THRESHOLD) {
      launchIdx = i;
      break;
    }
  }
  const calibrationSamples = samples.slice(0, Math.max(1, launchIdx));
  const baseline = mean(calibrationSamples.map((s) => s.magnitude));

  let v0 = 0;
  let integrating = false;
  for (let i = 1; i < samples.length; i++) {
    const s = samples[i];
    if (s.t > freefallStartT) break;
    if (!integrating && s.magnitude > LAUNCH_ACCEL_THRESHOLD) integrating = true;
    if (integrating) {
      const prev = samples[i - 1];
      const dt = (s.t - prev.t) / 1000;
      const netAccel = s.magnitude - baseline;
      if (dt > 0 && dt < 0.1) v0 += netAccel * dt;
    }
  }
  return Math.max(0, v0);
}

/** Find freefall boundaries mirroring client's detection logic in sensor.ts */
function findFreefallBoundaries(
  samples: readonly AccelSample[],
): { start: number; end: number } {
  let freefallStart = -1;
  let freefallEnd = -1;
  let launchDetected = false;
  let consecutiveLow = 0;
  let candidateStart = -1;
  let inFreefall = false;
  let landingConfirmCount = 0;
  let firstHighIdx = -1;

  for (let i = 0; i < samples.length; i++) {
    const mag = samples[i].magnitude;

    if (!launchDetected) {
      if (mag > LAUNCH_MAGNITUDE_THRESHOLD) {
        launchDetected = true;
      }
      continue;
    }

    if (!inFreefall) {
      if (mag < FREEFALL_MAGNITUDE_THRESHOLD) {
        if (consecutiveLow === 0) candidateStart = i;
        consecutiveLow++;
        if (consecutiveLow >= 2) {
          freefallStart = candidateStart;
          inFreefall = true;
        }
      } else {
        consecutiveLow = 0;
        candidateStart = -1;
      }
    } else {
      if (mag > LANDING_MAGNITUDE_THRESHOLD) {
        if (landingConfirmCount === 0) firstHighIdx = i;
        landingConfirmCount++;
        if (landingConfirmCount >= 2) {
          freefallEnd = firstHighIdx;
          break;
        }
      } else {
        landingConfirmCount = 0;
        firstHighIdx = -1;
      }
    }
  }

  return { start: freefallStart, end: freefallEnd };
}

/** Recalculate height using the same scoreHeight logic as the client */
function recalculateScoreHeight(
  samples: readonly AccelSample[],
): number {
  const { start, end } = findFreefallBoundaries(samples);
  if (start < 0 || end < 0) return -1;

  const durationMs = samples[end].t - samples[start].t;
  const durationSec = durationMs / 1000;
  const timeBased = (GRAVITY * durationSec * durationSec) / 8;

  const v0 = estimateV0FromSamples(samples, samples[start].t);
  if (v0 <= 0) return timeBased;

  const V0_MARGIN = 1.15;
  const v0Cap = (v0 * v0) / (2 * GRAVITY) * V0_MARGIN;
  return Math.min(timeBased, v0Cap);
}

function checkHeightDeviation(
  samples: readonly AccelSample[],
  clientHeight: number,
): CheckResult {
  const serverHeight = recalculateScoreHeight(samples);
  if (serverHeight <= 0) {
    return {
      name: "height_deviation",
      passed: false,
      score: 0.2,
      detail: "could not recalculate",
    };
  }

  const relDev = Math.abs(clientHeight - serverHeight) / serverHeight;
  const passed = relDev < RELATIVE_DEVIATION_THRESHOLD;
  return {
    name: "height_deviation",
    passed,
    score: passed ? 0 : Math.min(0.5, relDev),
    detail: `client=${clientHeight.toFixed(2)} server=${serverHeight.toFixed(2)} relDev=${(relDev * 100).toFixed(1)}%`,
  };
}

function checkNoisePattern(samples: readonly AccelSample[]): CheckResult {
  const { start, end } = findFreefallBoundaries(samples);
  const freefallSamples = start >= 0 && end > start
    ? samples.slice(start, end + 1)
    : samples;

  if (freefallSamples.length < 10) {
    return {
      name: "noise_pattern",
      passed: true,
      score: 0,
      detail: "insufficient samples for noise analysis",
    };
  }

  const magnitudes = freefallSamples.map((s) => s.magnitude);
  const sd = stdDev(magnitudes);

  const suspiciouslyPerfect = sd < NOISE_STD_MIN;
  const tooNoisy = sd > NOISE_STD_MAX && mean(magnitudes) < 2;

  if (suspiciouslyPerfect) {
    return {
      name: "noise_pattern",
      passed: false,
      score: 0.4,
      detail: `stddev=${sd.toFixed(4)} (suspiciously uniform)`,
    };
  }

  if (tooNoisy) {
    return {
      name: "noise_pattern",
      passed: false,
      score: 0.2,
      detail: `stddev=${sd.toFixed(4)} (excessive noise at low magnitude)`,
    };
  }

  return {
    name: "noise_pattern",
    passed: true,
    score: 0,
    detail: `stddev=${sd.toFixed(4)}`,
  };
}

/** Detect ground-drop style asymmetric throws where airtime vastly exceeds
 *  what the estimated launch velocity can explain. */
function checkAsymmetricThrow(
  samples: readonly AccelSample[],
  airtimeSeconds: number,
): CheckResult {
  const { start } = findFreefallBoundaries(samples);
  if (start < 0) {
    return {
      name: "asymmetric_throw",
      passed: true,
      score: 0,
      detail: "freefall not found (skipped)",
    };
  }

  const v0 = estimateV0FromSamples(samples, samples[start].t);
  if (v0 <= 0) {
    return {
      name: "asymmetric_throw",
      passed: true,
      score: 0,
      detail: "v0 not estimable (skipped)",
    };
  }

  const timeBased = (GRAVITY * airtimeSeconds * airtimeSeconds) / 8;
  const v0Based = (v0 * v0) / (2 * GRAVITY);
  const ratio = v0Based > 0 ? timeBased / v0Based : 0;

  // ratio > 2.0 = airtime implies >2x the height v0 justifies.
  // Strong indicator of drop-to-ground style asymmetric catch.
  const passed = ratio < 2.0;
  return {
    name: "asymmetric_throw",
    passed,
    score: passed ? 0 : Math.min(0.4, (ratio - 2.0) * 0.2),
    detail: `ratio=${ratio.toFixed(2)} (time=${timeBased.toFixed(2)}m v0=${v0Based.toFixed(2)}m)`,
  };
}

export type AntiCheatResult = {
  readonly anomalyScore: number;
  readonly checks: readonly CheckResult[];
  readonly serverHeight: number;
};

export function validateSensorData(
  samples: readonly AccelSample[],
  clientHeight: number,
  airtimeSeconds: number,
): AntiCheatResult {
  const checks: CheckResult[] = [
    checkSampleCount(samples, airtimeSeconds),
    checkSampleIntervalRegularity(samples),
    checkCalibrationBaseline(samples),
    checkLaunchSpike(samples),
    checkFreefallPresence(samples),
    checkLandingSpike(samples),
    checkHeightDeviation(samples, clientHeight),
    checkNoisePattern(samples),
    checkAsymmetricThrow(samples, airtimeSeconds),
  ];

  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const anomalyScore = Math.min(1.0, totalScore);
  const serverHeight = recalculateScoreHeight(samples);

  return { anomalyScore, checks, serverHeight };
}
