"use client";

async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
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

export async function generateFingerprint(): Promise<string> {
  const components = [
    getCanvasFingerprint(),
    getAudioFingerprint(),
    getScreenFingerprint(),
    navigator.userAgent,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ];

  return sha256Hex(components.join("|"));
}
