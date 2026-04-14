// ============================================================
// Share utilities — TikTok / X / Instagram
// ============================================================

const TIKTOK_SHARE_URL = "https://www.tiktok.com/upload";
const X_INTENT_URL = "https://twitter.com/intent/tweet";

type SharePlatform = "tiktok" | "x" | "instagram";

/** Build share text for the throw result */
export function buildShareText(
  heightMeters: number,
  locale: string,
): string {
  const h = heightMeters.toFixed(2);

  const templates: Record<string, string> = {
    ja: `${h}m！ Throw To Win で投げた。\nthrowtowin.kosukuma.com`,
    en: `${h}m! Threw my phone on Throw To Win.\nthrowtowin.kosukuma.com`,
    ko: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    "zh-CN": `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    "zh-TW": `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    es: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    fr: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    de: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    pt: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    ar: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    ru: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
    hi: `${h}m! Throw To Win\nthrowtowin.kosukuma.com`,
  };

  return templates[locale] ?? templates.en!;
}

/** Trigger download of a blob as a file */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Clean up after a short delay
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Share to a specific platform */
export function shareTo(
  platform: SharePlatform,
  videoBlob: Blob,
  heightMeters: number,
  locale: string,
): void {
  const text = buildShareText(heightMeters, locale);
  const filename = `throw-to-win-${heightMeters.toFixed(2)}m.mp4`;

  switch (platform) {
    case "tiktok":
      // Download video first, then open TikTok upload
      downloadBlob(videoBlob, filename);
      window.open(TIKTOK_SHARE_URL, "_blank");
      break;

    case "x": {
      // Download video, then open X intent with text
      downloadBlob(videoBlob, filename);
      const params = new URLSearchParams({ text });
      window.open(`${X_INTENT_URL}?${params.toString()}`, "_blank");
      break;
    }

    case "instagram":
      // Download video, then try to open Instagram
      downloadBlob(videoBlob, filename);
      // Try app deep link; falls back to just having the video downloaded
      window.open("instagram://camera", "_blank");
      break;
  }
}

/** Use Web Share API if available (mobile-first) */
export async function shareNative(
  videoBlob: Blob,
  heightMeters: number,
  locale: string,
): Promise<boolean> {
  if (!navigator.share || !navigator.canShare) return false;

  const text = buildShareText(heightMeters, locale);
  const file = new File(
    [videoBlob],
    `throw-to-win-${heightMeters.toFixed(2)}m.mp4`,
    { type: "video/mp4" },
  );

  const shareData = { text, files: [file] };
  if (!navigator.canShare(shareData)) return false;

  try {
    await navigator.share(shareData);
    return true;
  } catch {
    return false;
  }
}
