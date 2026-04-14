// ============================================================
// Device capability detection
// ============================================================

import type { CameraConstraints, DeviceCapability, QualityTier } from "./types";

/** Detect device capabilities */
export function detectCapabilities(): DeviceCapability {
  const hasMotionSensor = typeof DeviceMotionEvent !== "undefined";
  const hasCamera =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;
  const hasMediaRecorder = typeof MediaRecorder !== "undefined";
  const hasLocalStorage = checkLocalStorage();
  const supportsSharedArrayBuffer =
    typeof SharedArrayBuffer !== "undefined";

  const tier = detectPerformanceTier();

  return {
    tier,
    hasMotionSensor,
    hasCamera,
    hasMediaRecorder,
    hasLocalStorage,
    supportsSharedArrayBuffer,
  };
}

/** Detect performance tier based on hardware signals */
function detectPerformanceTier(): QualityTier {
  if (typeof navigator === "undefined") return "low";

  const cores = navigator.hardwareConcurrency ?? 2;
  // deviceMemory is NOT available on Safari/iOS — gate only on cores
  // iPhone 16 Pro: 6 cores, no deviceMemory → must still get "high"
  if (cores >= 6) return "high";
  if (cores >= 4) return "medium";
  return "low";
}

function checkLocalStorage(): boolean {
  try {
    const k = "__ttw__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Camera constraints per quality tier — always max quality for best slow-mo */
export const CAMERA_CONSTRAINTS: Record<QualityTier, CameraConstraints> = {
  high: { width: 1080, height: 1920, frameRate: 120 },
  medium: { width: 1080, height: 1920, frameRate: 60 },
  low: { width: 1080, height: 1920, frameRate: 60 },
};

/** Get all missing capabilities as a list of keys */
export function getMissingCapabilities(
  caps: DeviceCapability,
): string[] {
  const missing: string[] = [];
  if (!caps.hasMotionSensor) missing.push("motionSensor");
  if (!caps.hasCamera) missing.push("camera");
  if (!caps.hasMediaRecorder) missing.push("mediaRecorder");
  if (!caps.hasLocalStorage) missing.push("localStorage");
  return missing;
}

/** Check if the device is fully compatible */
export function isFullyCompatible(caps: DeviceCapability): boolean {
  return getMissingCapabilities(caps).length === 0;
}
