// ============================================================
// Throw To Win — Core Type Definitions
// ============================================================

/** A single throw record persisted in localStorage */
export type ThrowRecord = {
  readonly id: string;
  readonly timestamp: string; // ISO 8601
  readonly heightMeters: number;
  readonly airtimeSeconds: number;
  readonly isPersonalBest: boolean;
  readonly submittedToRanking: boolean; // future-proof
};

/** Consent state */
export type ConsentState = {
  readonly agreed: boolean;
  readonly agreedAt: string; // ISO 8601
  readonly version: string;
};

/** User settings */
export type UserSettings = {
  readonly cameraDirection: "rear" | "front";
  readonly locale: string;
};

/** Aggregate stats */
export type UserStats = {
  readonly personalBest: number;
  readonly totalThrows: number;
  readonly totalAirtimeSeconds: number;
};

/** Full localStorage schema */
export type AppData = {
  readonly userId: string;
  readonly displayName: string;
  readonly consent: ConsentState;
  readonly settings: UserSettings;
  readonly throws: readonly ThrowRecord[];
  readonly stats: UserStats;
};

/** Accelerometer sample */
export type AccelSample = {
  readonly t: number; // ms timestamp (performance.now)
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly magnitude: number; // sqrt(x²+y²+z²)
};

/** Throw detection state machine */
export type ThrowPhase =
  | "idle"
  | "calibrating"
  | "countdown"
  | "waiting-throw" // post-countdown, waiting for launch
  | "launched" // launch spike detected, transitioning to freefall
  | "freefall"
  | "landed"
  | "unsupported" // no devicemotion events received (sensor unavailable)
  | "error";

/** Throw detection result */
export type ThrowResult = {
  readonly airtimeSeconds: number;
  readonly heightMeters: number;
  readonly freefallStartTime: number;
  readonly landingTime: number;
  readonly peakTime: number; // midpoint of freefall
  /** Estimated initial upward velocity from launch-phase integration (m/s) */
  readonly estimatedV0: number;
};

/** Camera quality tier */
export type QualityTier = "high" | "medium" | "low";

/** Camera constraints per quality tier */
export type CameraConstraints = {
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
};

/** Video processing status */
export type VideoProcessingStatus =
  | "idle"
  | "loading-ffmpeg"
  | "processing"
  | "applying-slowmo"
  | "encoding"
  | "done"
  | "failed";

/** Device capability info */
export type DeviceCapability = {
  readonly tier: QualityTier;
  readonly hasMotionSensor: boolean;
  readonly hasCamera: boolean;
  readonly hasMediaRecorder: boolean;
  readonly hasLocalStorage: boolean;
  readonly supportsSharedArrayBuffer: boolean;
};

/** Supported locales */
export const SUPPORTED_LOCALES = [
  "ja",
  "en",
  "zh-CN",
  "zh-TW",
  "ko",
  "es",
  "fr",
  "de",
  "pt",
  "ar",
  "ru",
  "hi",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "ja";

/** Consent version — bump when terms change */
export const CONSENT_VERSION = "1.0.0";

/** localStorage key */
export const STORAGE_KEY = "ttw_data";
