// ============================================================
// Landing page throw detector — lightweight version
//
// Only detects: launch → freefall → landing
// No calibration, no countdown, no height calculation.
// Calls onThrow() when a throw-and-catch cycle completes.
// ============================================================

const LAUNCH_THRESHOLD = 18.0;
const FREEFALL_THRESHOLD = 5.0;
const LANDING_THRESHOLD = 12.0;
const MIN_FREEFALL_MS = 80;
const MAX_FREEFALL_MS = 4000;

type Phase = "idle" | "launched" | "freefall";

export type LandingThrowDetectorOptions = {
  readonly onThrow: () => void;
};

export class LandingThrowDetector {
  private phase: Phase = "idle";
  private freefallStart = 0;
  private handler: ((e: DeviceMotionEvent) => void) | null = null;
  private readonly onThrow: () => void;

  constructor(opts: LandingThrowDetectorOptions) {
    this.onThrow = opts.onThrow;
  }

  start(): void {
    if (this.handler) return;
    this.handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const now = performance.now();

      switch (this.phase) {
        case "idle":
          if (mag > LAUNCH_THRESHOLD) {
            this.phase = "launched";
          }
          break;
        case "launched":
          if (mag < FREEFALL_THRESHOLD) {
            this.phase = "freefall";
            this.freefallStart = now;
          } else if (mag <= LAUNCH_THRESHOLD) {
            // Launch spike ended without freefall — reset
            this.phase = "idle";
          }
          break;
        case "freefall": {
          const elapsed = now - this.freefallStart;
          if (elapsed > MAX_FREEFALL_MS) {
            this.phase = "idle";
            break;
          }
          if (mag > LANDING_THRESHOLD && elapsed > MIN_FREEFALL_MS) {
            this.phase = "idle";
            this.onThrow();
          }
          break;
        }
      }
    };
    window.addEventListener("devicemotion", this.handler);
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.phase = "idle";
  }
}
