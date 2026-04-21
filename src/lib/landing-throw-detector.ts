// ============================================================
// Landing page shake detector
//
// Detects 5 distinct back-and-forth shakes within 3 seconds.
// Uses gravity removal + hysteresis peak detection + alternating
// sign requirement. A single throw/catch = 1 reversal, not 5.
// ============================================================

/** Gravity-removed acceleration above this → enter peak state */
const T_HIGH = 12;
/** Must drop below this to exit peak state (hysteresis) */
const T_LOW = 6;
/** Minimum gap between opposite-sign peaks to count as a shake */
const MIN_PEAK_GAP_MS = 80;
/** Maximum gap — beyond this, peaks are unrelated */
const MAX_PEAK_GAP_MS = 600;
/** All shakes must occur within this window */
const SHAKE_WINDOW_MS = 3000;
/** Number of distinct direction reversals needed */
const REQUIRED_SHAKES = 5;
/** Reset state if no peak for this long */
const IDLE_RESET_MS = 2000;
/** Gravity low-pass filter smoothing factor */
const GRAVITY_ALPHA = 0.8;

type PeakState = "neutral" | "positive" | "negative";

type Options = {
  readonly onThrow: () => void;
};

export class LandingThrowDetector {
  private handler: ((e: DeviceMotionEvent) => void) | null = null;
  private fired = false;

  // Gravity estimate (low-pass filtered)
  private gx = 0;
  private gy = 0;
  private gz = 0;
  private gravityInitialized = false;

  // Hysteresis state machine
  private peakState: PeakState = "neutral";
  private lastPeakSign: 1 | -1 | 0 = 0;
  private lastPeakTime = 0;

  // Shake counting
  private shakeTimes: number[] = [];

  constructor(private readonly options: Options) {}

  start(): void {
    if (this.handler) return;

    this.handler = (e: DeviceMotionEvent) => {
      if (this.fired) return;
      const a = e.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;

      const now = e.timeStamp || performance.now();

      // --- Step 1: Remove gravity with low-pass filter ---
      if (!this.gravityInitialized) {
        this.gx = a.x;
        this.gy = a.y;
        this.gz = a.z;
        this.gravityInitialized = true;
        return;
      }

      this.gx = GRAVITY_ALPHA * this.gx + (1 - GRAVITY_ALPHA) * a.x;
      this.gy = GRAVITY_ALPHA * this.gy + (1 - GRAVITY_ALPHA) * a.y;
      this.gz = GRAVITY_ALPHA * this.gz + (1 - GRAVITY_ALPHA) * a.z;

      // --- Step 2: Signed scalar (sum of linear acceleration axes) ---
      const s = (a.x - this.gx) + (a.y - this.gy) + (a.z - this.gz);

      // --- Step 3: Hysteresis peak detection ---
      let peakSign: 1 | -1 | 0 = 0;

      if (this.peakState === "neutral") {
        if (s > T_HIGH) {
          this.peakState = "positive";
          peakSign = 1;
        } else if (s < -T_HIGH) {
          this.peakState = "negative";
          peakSign = -1;
        }
      } else if (this.peakState === "positive") {
        if (s < T_LOW) this.peakState = "neutral";
      } else if (this.peakState === "negative") {
        if (s > -T_LOW) this.peakState = "neutral";
      }

      // --- Idle reset ---
      if (now - this.lastPeakTime > IDLE_RESET_MS && this.lastPeakTime > 0) {
        this.lastPeakSign = 0;
        this.shakeTimes = [];
      }

      // --- Step 4: Count alternating-sign peaks as shakes ---
      if (peakSign !== 0) {
        const dt = now - this.lastPeakTime;

        if (
          this.lastPeakSign !== 0 &&
          peakSign !== this.lastPeakSign &&
          dt >= MIN_PEAK_GAP_MS &&
          dt <= MAX_PEAK_GAP_MS
        ) {
          this.shakeTimes.push(now);
          // Prune old timestamps
          this.shakeTimes = this.shakeTimes.filter(t => now - t < SHAKE_WINDOW_MS);

          if (this.shakeTimes.length >= REQUIRED_SHAKES) {
            this.fired = true;
            this.options.onThrow();
            return;
          }
        }

        this.lastPeakSign = peakSign;
        this.lastPeakTime = now;
      }
    };

    window.addEventListener("devicemotion", this.handler, { passive: true });
  }

  stop(): void {
    if (this.handler) {
      window.removeEventListener("devicemotion", this.handler);
      this.handler = null;
    }
    this.resetState();
  }

  private resetState(): void {
    this.gx = 0;
    this.gy = 0;
    this.gz = 0;
    this.gravityInitialized = false;
    this.peakState = "neutral";
    this.lastPeakSign = 0;
    this.lastPeakTime = 0;
    this.shakeTimes = [];
    this.fired = false;
  }
}
