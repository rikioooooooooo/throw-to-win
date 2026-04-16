// ============================================================
// Accelerometer sensor — robust throw detection
//
// Algorithm:
//   calibrating → waiting-throw → launched → freefall → landed
//
// Key design decisions:
//   - Phase transitions happen INLINE in devicemotion handler (zero latency)
//   - No cascading moving average (raw magnitude for phase detection)
//   - Launch spike required before freefall (prevents false triggers)
//   - Time-based freefall confirmation (not sample-count based)
//   - Generous freefall threshold (accommodates phone spinning)
//   - Distinct landing threshold (clear catch detection)
// ============================================================

import type { AccelSample, ThrowPhase, ThrowResult } from "./types";
import { calculateHeight, calculateScoreHeight, estimatePeakTime, GRAVITY } from "./physics";

// ---- Thresholds (absolute, in m/s²) ----
const LAUNCH_THRESHOLD = 15.0; // above = throw detected (~1.5G)
const LAUNCH_CONFIRM_COUNT = 2; // consecutive samples above threshold to confirm launch
const FREEFALL_THRESHOLD = 8.0; // below = freefall (tolerates spinning at up to ~2 rev/s; centripetal = ω²r where r≈0.05m → 7.9 m/s²)
const LANDING_THRESHOLD = 12.0; // above after freefall = caught (~1.2G, lowered from 15 to detect soft catches ~10ms earlier)
const LANDING_CONFIRM_COUNT = 2; // consecutive samples above threshold to avoid false landings from spin noise
const FREEFALL_CONFIRM_MS = 40; // sustained low-G to confirm freefall (filters brief dips during hand movement)
const LAUNCH_TIMEOUT_MS = 1000; // reset if no freefall within 1s of launch
const MIN_FREEFALL_MS = 60; // minimum valid freefall duration
const MAX_FREEFALL_MS = 4000; // safety cap — 4s freefall ≈ 20m throw (physically impossible)
const CALIBRATION_SAMPLES = 50; // ~0.5s at 100Hz

export type SensorCallback = (
  phase: ThrowPhase,
  result?: ThrowResult,
) => void;

export class ThrowDetector {
  private samples: AccelSample[] = [];
  private phase: ThrowPhase = "idle";
  private calibrationBaseline = 9.81;
  private freefallStartTime = 0;
  private freefallCandidateStart = 0;
  private launchTime = 0;
  private handler: ((event: DeviceMotionEvent) => void) | null = null;
  private callback: SensorCallback;
  private calibrationSamples: number[] = [];
  private launchConfirmCount = 0;
  private landingConfirmCount = 0;
  private firstLandingSampleTime = 0;
  private estimatedV0 = 0;
  private maxRealtimeHeight = 0;

  constructor(callback: SensorCallback) {
    this.callback = callback;
  }

  static async requestPermission(): Promise<boolean> {
    if (
      typeof DeviceMotionEvent !== "undefined" &&
      "requestPermission" in DeviceMotionEvent &&
      typeof (
        DeviceMotionEvent as unknown as {
          requestPermission: () => Promise<string>;
        }
      ).requestPermission === "function"
    ) {
      try {
        const state = await (
          DeviceMotionEvent as unknown as {
            requestPermission: () => Promise<string>;
          }
        ).requestPermission();
        return state === "granted";
      } catch {
        return false;
      }
    }
    return typeof DeviceMotionEvent !== "undefined";
  }

  static isAvailable(): boolean {
    return typeof DeviceMotionEvent !== "undefined";
  }

  startCalibration(): void {
    this.phase = "calibrating";
    this.calibrationSamples = [];
    this.samples = [];
    this.freefallCandidateStart = 0;
    this.launchTime = 0;
    this.callback(this.phase);

    this.handler = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null)
        return;

      const x = accel.x ?? 0;
      const y = accel.y ?? 0;
      const z = accel.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = performance.now();

      this.samples.push({ t: now, x, y, z, magnitude });

      // Keep buffer bounded
      if (this.samples.length > 500) {
        this.samples = this.samples.slice(-250);
      }

      this.processPhase(magnitude, now);
    };

    window.addEventListener("devicemotion", this.handler, { passive: true });
  }

  private processPhase(magnitude: number, now: number): void {
    switch (this.phase) {
      case "calibrating": {
        this.calibrationSamples.push(magnitude);
        if (this.calibrationSamples.length >= CALIBRATION_SAMPLES) {
          this.calibrationBaseline =
            this.calibrationSamples.reduce((a, b) => a + b, 0) /
            this.calibrationSamples.length;
          // Auto-transition: start listening for throws immediately after calibration
          // This prevents the bug where throwing right at countdown=0 is missed
          // because the phase was still "calibrating"
          this.phase = "waiting-throw";
          this.launchConfirmCount = 0;
          this.callback(this.phase);
        }
        break;
      }

      case "waiting-throw": {
        // Detect launch spike — require consecutive samples above threshold
        // to filter noise spikes from triggering false launches
        if (magnitude > LAUNCH_THRESHOLD) {
          this.launchConfirmCount++;
          if (this.launchConfirmCount >= LAUNCH_CONFIRM_COUNT) {
            this.launchTime = now;
            this.freefallCandidateStart = 0;
            this.launchConfirmCount = 0;
            this.phase = "launched";
            this.callback(this.phase);
          }
        } else {
          this.launchConfirmCount = 0;
        }
        break;
      }

      case "launched": {
        // After launch spike, look for sustained low-G (freefall)
        if (magnitude < FREEFALL_THRESHOLD) {
          if (this.freefallCandidateStart === 0) {
            this.freefallCandidateStart = now;
          }
          if (now - this.freefallCandidateStart >= FREEFALL_CONFIRM_MS) {
            this.freefallStartTime = this.freefallCandidateStart;
            this.estimatedV0 = this.computeV0FromLaunch();
            this.phase = "freefall";
            this.callback(this.phase);
          }
        } else {
          this.freefallCandidateStart = 0;
        }

        // Timeout: if no freefall detected within 1s, it was a false launch
        if (now - this.launchTime > LAUNCH_TIMEOUT_MS) {
          this.phase = "waiting-throw";
          this.freefallCandidateStart = 0;
          this.callback(this.phase);
        }
        break;
      }

      case "freefall": {
        const freefallElapsed = now - this.freefallStartTime;

        // Detect landing: require LANDING_CONFIRM_COUNT consecutive samples
        // above threshold to filter false positives from phone spin during flight.
        // Backdate landingTime to the FIRST high-G sample so confirmation
        // logic doesn't re-introduce detection delay.
        if (magnitude > LANDING_THRESHOLD) {
          if (this.landingConfirmCount === 0) {
            this.firstLandingSampleTime = now;
          }
          this.landingConfirmCount++;
        } else {
          this.landingConfirmCount = 0;
          this.firstLandingSampleTime = 0;
        }

        const isLanding =
          this.landingConfirmCount >= LANDING_CONFIRM_COUNT ||
          freefallElapsed > MAX_FREEFALL_MS;

        if (isLanding) {
          // Use backdated time of first high-G sample for precision
          const landingTime =
            this.firstLandingSampleTime > 0
              ? this.firstLandingSampleTime
              : now;
          const freefallDuration = landingTime - this.freefallStartTime;

          if (freefallDuration < MIN_FREEFALL_MS) {
            // Too short — noise, reset to waiting
            this.phase = "waiting-throw";
            this.freefallCandidateStart = 0;
            this.landingConfirmCount = 0;
            this.firstLandingSampleTime = 0;
            this.callback(this.phase);
            return;
          }

          // Cap freefall at timeout to prevent absurd height values
          const clampedDuration = Math.min(freefallDuration, MAX_FREEFALL_MS);
          const airtimeSeconds = clampedDuration / 1000;
          const heightMeters = calculateScoreHeight(airtimeSeconds, this.estimatedV0);
          const peakTime = estimatePeakTime(
            this.freefallStartTime,
            this.freefallStartTime + clampedDuration,
          );

          this.phase = "landed";
          this.callback(this.phase, {
            airtimeSeconds,
            heightMeters,
            freefallStartTime: this.freefallStartTime,
            landingTime,
            peakTime,
            estimatedV0: this.estimatedV0,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  startWaitingForThrow(): void {
    // Skip if already in an active detection phase (prevents resetting mid-throw)
    if (
      this.phase === "waiting-throw" ||
      this.phase === "launched" ||
      this.phase === "freefall"
    ) {
      return;
    }
    this.phase = "waiting-throw";
    this.freefallCandidateStart = 0;
    this.launchTime = 0;
    this.launchConfirmCount = 0;
    this.landingConfirmCount = 0;
    this.firstLandingSampleTime = 0;
    this.maxRealtimeHeight = 0;
    this.callback(this.phase);
  }

  /** Animation frame tick — only for realtime height polling */
  tick(): void {
    // Phase detection is inline in devicemotion handler.
  }

  getPhase(): ThrowPhase {
    return this.phase;
  }

  getBaseline(): number {
    return this.calibrationBaseline;
  }

  isCalibrated(): boolean {
    return this.calibrationSamples.length >= CALIBRATION_SAMPLES;
  }

  getFreefallStartTime(): number {
    return this.freefallStartTime;
  }

  getEstimatedV0(): number {
    return this.estimatedV0;
  }

  /**
   * Estimate initial upward velocity by integrating acceleration magnitude
   * over the launch window (from first high-G sample to freefall start).
   *
   * Uses |a| - g (magnitude minus gravity) which is orientation-independent.
   * This overestimates for angled throws (~15-30% error) but is simple and
   * works at 60Hz with minimal data points. Phase 1 approach.
   *
   * Note: Integrates ALL netAccel values (including negative / deceleration)
   * to avoid systematic overestimation from dropping the release deceleration.
   * Only the final v0 is clamped to >= 0.
   */
  private computeV0FromLaunch(): number {
    const LAUNCH_ACCEL_THRESHOLD = 12; // m/s² — start of meaningful throw force
    let v0 = 0;
    let integrating = false;

    for (let i = 1; i < this.samples.length; i++) {
      const sample = this.samples[i];
      // Stop at freefall start — don't integrate the low-G freefall samples
      if (sample.t > this.freefallStartTime) break;

      if (!integrating && sample.magnitude > LAUNCH_ACCEL_THRESHOLD) {
        integrating = true;
      }

      if (integrating) {
        const prev = this.samples[i - 1];
        const dt = (sample.t - prev.t) / 1000;
        // Net acceleration = total magnitude minus gravity baseline
        // Include negative values (deceleration before release) for accurate v0
        const netAccel = sample.magnitude - this.calibrationBaseline;
        if (dt > 0 && dt < 0.1) {
          v0 += netAccel * dt;
        }
      }
    }

    return Math.max(0, v0);
  }

  /** Return a copy of the collected sensor samples for server-side verification */
  getSamples(): readonly AccelSample[] {
    return [...this.samples];
  }

  getRealtimeHeight(): number {
    if (this.phase !== "freefall") return 0;
    const elapsed = (performance.now() - this.freefallStartTime) / 1000;
    let h: number;
    if (this.estimatedV0 > 0) {
      // v₀-based trajectory: tracks actual phone altitude during freefall.
      // Must match the canvas overlay formula exactly for consistency.
      h = Math.max(0, this.estimatedV0 * elapsed - (GRAVITY * elapsed * elapsed) / 2);
    } else {
      h = calculateHeight(elapsed);
    }
    if (h > this.maxRealtimeHeight) {
      this.maxRealtimeHeight = h;
    }
    return this.maxRealtimeHeight;
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.phase = "idle";
  }

  reset(): void {
    this.stop();
    this.samples = [];
    this.calibrationSamples = [];
    this.freefallCandidateStart = 0;
    this.freefallStartTime = 0;
    this.launchTime = 0;
    this.launchConfirmCount = 0;
    this.landingConfirmCount = 0;
    this.firstLandingSampleTime = 0;
    this.estimatedV0 = 0;
    this.maxRealtimeHeight = 0;
    this.phase = "idle";
  }
}
