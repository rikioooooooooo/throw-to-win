// ============================================================
// Landing page shake detector
//
// Detects a vigorous shake gesture and calls onThrow().
// Simpler and more reliable than full throw detection.
// ============================================================

const SHAKE_THRESHOLD = 25; // m/s² — total acceleration magnitude to count as a shake
const SHAKE_COUNT = 3;      // number of threshold crossings needed
const SHAKE_WINDOW_MS = 800; // all crossings must happen within this window

type Options = {
  readonly onThrow: () => void;
};

export class LandingThrowDetector {
  private handler: ((e: DeviceMotionEvent) => void) | null = null;
  private shakeTimestamps: number[] = [];
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

      if (mag > SHAKE_THRESHOLD) {
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
    this.fired = false;
  }
}
