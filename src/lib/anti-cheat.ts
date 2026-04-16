import type { AccelSample } from "./types";

const GRAVITY = 9.81;
const MIN_SAMPLE_RATE_HZ = 40;
const MAX_DT_COEFFICIENT_OF_VARIATION = 0.6;
const CALIBRATION_MAGNITUDE_MIN = 8.5;
const CALIBRATION_MAGNITUDE_MAX = 11.0;
const LAUNCH_MAGNITUDE_THRESHOLD = 15;
const FREEFALL_MAGNITUDE_THRESHOLD = 5.5;
const MIN_FREEFALL_SAMPLES = 3;
const HEIGHT_DEVIATION_THRESHOLD = 0.5;
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
    if (foundFreefall && sample.magnitude > LAUNCH_MAGNITUDE_THRESHOLD) {
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

function recalculateHeightFromFreefall(
  samples: readonly AccelSample[],
): number {
  let freefallStart = -1;
  let freefallEnd = -1;
  let inFreefall = false;

  for (let i = 0; i < samples.length; i++) {
    if (!inFreefall && samples[i].magnitude < FREEFALL_MAGNITUDE_THRESHOLD) {
      freefallStart = i;
      inFreefall = true;
    }
    if (inFreefall && samples[i].magnitude >= LAUNCH_MAGNITUDE_THRESHOLD) {
      freefallEnd = i;
      break;
    }
  }

  if (freefallStart < 0 || freefallEnd < 0) return -1;

  const durationMs = samples[freefallEnd].t - samples[freefallStart].t;
  const durationSec = durationMs / 1000;
  return (GRAVITY * durationSec * durationSec) / 8;
}

function checkHeightDeviation(
  samples: readonly AccelSample[],
  clientHeight: number,
): CheckResult {
  const serverHeight = recalculateHeightFromFreefall(samples);
  if (serverHeight < 0) {
    return {
      name: "height_deviation",
      passed: false,
      score: 0.2,
      detail: "could not recalculate",
    };
  }

  const deviation = Math.abs(clientHeight - serverHeight);
  const passed = deviation < HEIGHT_DEVIATION_THRESHOLD;
  return {
    name: "height_deviation",
    passed,
    score: passed ? 0 : Math.min(0.5, deviation * 0.5),
    detail: `client=${clientHeight.toFixed(2)} server=${serverHeight.toFixed(2)} dev=${deviation.toFixed(2)}`,
  };
}

function checkNoisePattern(samples: readonly AccelSample[]): CheckResult {
  if (samples.length < 10) {
    return {
      name: "noise_pattern",
      passed: true,
      score: 0,
      detail: "insufficient samples for noise analysis",
    };
  }

  const magnitudes = samples.map((s) => s.magnitude);
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
  ];

  const totalScore = checks.reduce((sum, c) => sum + c.score, 0);
  const anomalyScore = Math.min(1.0, totalScore);
  const serverHeight = recalculateHeightFromFreefall(samples);

  return { anomalyScore, checks, serverHeight };
}
