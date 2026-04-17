"use client";

const STABLE_ID_KEY = "ttw_device_id";

function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

async function sha256Hex(data: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(buffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    let result = "";
    for (let i = 0; i < data.length; i += 64) {
      result += djb2Hash(data.slice(i, i + 64));
    }
    return result.slice(0, 64);
  }
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-canvas";

    ctx.textBaseline = "top";
    ctx.font = '14px "Arial"';
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("ThrowToWin", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("ThrowToWin", 4, 17);

    return canvas.toDataURL();
  } catch {
    return "canvas-error";
  }
}

function getAudioFingerprint(): string {
  try {
    const AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext })
        .webkitAudioContext;
    if (!AudioContext) return "no-audio";

    const ctx = new AudioContext();
    const result = [
      ctx.sampleRate,
      ctx.destination.maxChannelCount,
      ctx.destination.channelCount,
    ].join(",");
    ctx.close();
    return result;
  } catch {
    return "audio-error";
  }
}

function getScreenFingerprint(): string {
  return [
    screen.width,
    screen.height,
    screen.colorDepth,
    window.devicePixelRatio,
  ].join(",");
}

function getHardwareFingerprint(): string {
  return [
    navigator.hardwareConcurrency ?? 0,
    navigator.maxTouchPoints ?? 0,
    navigator.platform ?? "",
    (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 0,
  ].join(",");
}

/**
 * Primary device identity — localStorage-based stable UUID.
 * Unlike browser fingerprinting, this ID survives browser updates
 * and GPU driver changes, preventing users from losing their
 * ranking history, personal best, and display name.
 */
export async function generateFingerprint(): Promise<string> {
  try {
    const stored = localStorage.getItem(STABLE_ID_KEY);
    if (stored) return stored;

    const id =
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STABLE_ID_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Secondary fingerprint hash for anti-cheat purposes.
 * Uses stable browser signals (canvas, audio, screen, hardware,
 * timezone, language) — intentionally excludes userAgent and
 * WebGL renderer which change on browser/driver updates.
 */
export async function generateFingerprintHash(): Promise<string> {
  try {
    const components = [
      getCanvasFingerprint(),
      getAudioFingerprint(),
      getScreenFingerprint(),
      getHardwareFingerprint(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ];

    return await sha256Hex(components.join("|"));
  } catch {
    return "hash-error";
  }
}
