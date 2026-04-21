// ============================================================
// Landing page shake detector
//
// Detects repeated vigorous shakes and calls onThrow().
// Requires 5 distinct shakes within 3 seconds.
// Each shake must be separated by a cooldown to avoid
// counting one continuous motion as multiple shakes.
// ============================================================

const SHAKE_THRESHOLD = 35; // m/s² — strong shake only
const SHAKE_COUNT = 5;      // number of distinct shakes needed
const SHAKE_WINDOW_MS = 3000; // all shakes must happen within this window
const SHAKE_COOLDOWN_MS = 150; // minimum gap between counted shakes

type Options = {
  readonly onThrow: () => void;
};

export class LandingThrowDetector {
  private handler: ((e: DeviceMotionEvent) => void) | null = null;
  private shakeTimestamps: number[] = [];
  private lastShakeTime = 0;
  private fired = false;

  constructor(private readonly options: Options) {}

  start(): void {
    if (this.handler) return;
    this.handler = (e: DeviceMotionEvent) => {
      if (this.fired) return;
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const now = performance.now();

      if (mag > SHAKE_THRESHOLD && now - this.lastShakeTime > SHAKE_COOLDOWN_MS) {
        this.lastShakeTime = now;
        this.shakeTimestamps.push(now);
        // Remove old timestamps outside the window
        this.shakeTimestamps = this.shakeTimestamps.filter(t => now - t < SHAKE_WINDOW_MS);

        if (this.shakeTimestamps.length >= SHAKE_COUNT) {
          this.fired = true;
          this.options.onThrow();
        }
      }
    };
    window.addEventListener("devicemotion", this.handler, { passive: true });
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.shakeTimestamps = [];
    this.lastShakeTime = 0;
    this.fired = false;
  }
}
