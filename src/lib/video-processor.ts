// ============================================================
// Video processor — ffmpeg.wasm wrapper
// Handles: slow-motion around peak, WebM → MP4 conversion
// Text overlay is baked in via Canvas compositing (use-camera.ts)
//
// Strategy: multi-pass extract + concat (more reliable than
// single-pass filter_complex which dropped frames).
// ============================================================

import type { VideoProcessingStatus } from "./types";

type StatusCallback = (
  status: VideoProcessingStatus,
  progress?: number,
) => void;

let ffmpegPromise: Promise<Awaited<ReturnType<typeof loadFFmpeg>>> | null =
  null;

async function loadFFmpeg() {
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { fetchFile, toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      "application/wasm",
    ),
  });

  return { ffmpeg, fetchFile };
}

async function getFFmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = loadFFmpeg().catch((e) => {
      ffmpegPromise = null; // allow retry on failure
      throw e;
    });
  }
  return ffmpegPromise;
}

/** Preload ffmpeg in background */
export function preloadFFmpeg(): void {
  getFFmpeg().catch(() => {});
}

// ============================================================
// Public API
// ============================================================

/**
 * Process video with slow-motion around the peak.
 *
 * Strategy:
 *   1. Try multi-pass slow-mo (extract parts → slow peak → concat)
 *   2. Fall back to simple re-encode
 *   3. Fall back to returning original blob
 */
export async function processVideo(
  videoBlob: Blob,
  opts: {
    peakTimeOffset: number;
    onStatus: StatusCallback;
  },
): Promise<Blob> {
  const { peakTimeOffset, onStatus } = opts;

  // Guard: blobs >50MB can OOM ffmpeg.wasm (limited WASM heap).
  // Skip processing entirely and return raw blob for JS-based SlowMoPlayer fallback.
  const MAX_BLOB_SIZE = 50 * 1024 * 1024; // 50MB
  if (videoBlob.size > MAX_BLOB_SIZE) {
    onStatus("done", 100);
    return videoBlob;
  }

  // Guard: if peakTimeOffset is invalid (negative, NaN, absurdly large),
  // skip slow-mo entirely and just re-encode for MP4 compatibility.
  if (!Number.isFinite(peakTimeOffset) || peakTimeOffset < 0.1 || peakTimeOffset > 30) {
    try {
      return await simpleReencode(videoBlob, onStatus);
    } catch {
      onStatus("done", 100);
      return videoBlob;
    }
  }

  try {
    return await processWithSlowMo(videoBlob, peakTimeOffset, onStatus);
  } catch {
    try {
      return await simpleReencode(videoBlob, onStatus);
    } catch {
      onStatus("done", 100);
      return videoBlob;
    }
  }
}

// ============================================================
// Internal processing functions
// ============================================================

/** Common encode args for consistent output across all segments */
const ENCODE_ARGS = [
  "-c:v", "libx264",
  "-preset", "ultrafast",
  "-crf", "23",
  "-pix_fmt", "yuv420p",
  "-r", "60", // consistent fps across all parts (critical for concat)
  "-an", // drop audio (slow-mo audio sounds unnatural)
] as const;

/**
 * Multi-pass slow-motion: extract 3 parts → slow the peak → concat.
 * More reliable than single-pass filter_complex which could drop frames.
 *
 * 5x slow-mo (0.2x speed) — dramatic slow-motion around the peak.
 * At 60fps source, 5x gives 12fps effective (cinematic).
 * At 120fps source, 5x gives 24fps (film-like).
 */
async function processWithSlowMo(
  videoBlob: Blob,
  peakTimeOffset: number,
  onStatus: StatusCallback,
): Promise<Blob> {
  onStatus("loading-ffmpeg");
  const { ffmpeg, fetchFile } = await getFFmpeg();

  const inputName = videoBlob.type.includes("mp4")
    ? "input.mp4"
    : "input.webm";
  const tempFiles = [inputName, "part1.mp4", "part2.mp4", "part3.mp4", "list.txt", "output.mp4"];

  try {
    onStatus("processing", 5);
    await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));

    // Slow-mo window: 0.3s before peak to 0.3s after peak
    const slowStart = Math.max(0, peakTimeOffset - 0.3);
    const slowEnd = peakTimeOffset + 0.3;
    const slowDuration = slowEnd - slowStart;

    // Guard: near-zero slow-mo segment would produce empty/corrupt ffmpeg output
    if (slowDuration < 0.05) {
      throw new Error("Slow-mo segment too short");
    }

    onStatus("applying-slowmo", 15);

    // Pass 1: before peak (normal speed)
    const hasPre = slowStart > 0.05;
    if (hasPre) {
      await ffmpeg.exec([
        "-i", inputName,
        "-t", slowStart.toFixed(3),
        ...ENCODE_ARGS,
        "-y", "part1.mp4",
      ]);
    }

    onStatus("applying-slowmo", 35);

    // Pass 2: peak section (5x slow-mo = 0.2x speed)
    // Input seeking (-ss/-t BEFORE -i) so -t limits INPUT duration.
    // With output seeking (-ss after -i), -t limits OUTPUT time, and
    // setpts=5*PTS stretches the output clock → only 1/5 of source captured per second.
    await ffmpeg.exec([
      "-ss", slowStart.toFixed(3),
      "-t", slowDuration.toFixed(3),
      "-i", inputName,
      "-vf", "setpts=5*(PTS-STARTPTS)",
      ...ENCODE_ARGS,
      "-y", "part2.mp4",
    ]);

    onStatus("applying-slowmo", 55);

    // Pass 3: after peak (normal speed)
    // Input seeking for consistency with Part 2
    await ffmpeg.exec([
      "-ss", slowEnd.toFixed(3),
      "-i", inputName,
      "-vf", "setpts=PTS-STARTPTS",
      ...ENCODE_ARGS,
      "-y", "part3.mp4",
    ]);

    onStatus("encoding", 75);

    // Build concat list — only include parts that produced valid output
    const parts: string[] = [];
    if (hasPre) {
      try {
        const d = await ffmpeg.readFile("part1.mp4");
        if ((d as Uint8Array).length > 100) parts.push("file 'part1.mp4'");
      } catch { /* skip empty part */ }
    }
    try {
      const d = await ffmpeg.readFile("part2.mp4");
      if ((d as Uint8Array).length > 100) parts.push("file 'part2.mp4'");
    } catch { /* skip empty part */ }
    try {
      const d = await ffmpeg.readFile("part3.mp4");
      if ((d as Uint8Array).length > 100) parts.push("file 'part3.mp4'");
    } catch { /* skip empty part */ }

    if (parts.length === 0) {
      throw new Error("No valid segments produced");
    }

    // Concat all parts
    await ffmpeg.writeFile(
      "list.txt",
      new TextEncoder().encode(parts.join("\n") + "\n"),
    );

    await ffmpeg.exec([
      "-f", "concat",
      "-safe", "0",
      "-i", "list.txt",
      "-c", "copy",
      "-movflags", "+faststart",
      "-y", "output.mp4",
    ]);

    onStatus("encoding", 95);
    const data = await ffmpeg.readFile("output.mp4");
    const result = new Blob([(data as Uint8Array).slice()], {
      type: "video/mp4",
    });

    onStatus("done", 100);
    return result;
  } finally {
    // Always clean up temp files — prevents WASM heap leak on retry
    for (const f of tempFiles) {
      await ffmpeg.deleteFile(f).catch(() => {});
    }
  }
}

/**
 * Simple re-encode without slow-mo (fallback).
 */
async function simpleReencode(
  videoBlob: Blob,
  onStatus: StatusCallback,
): Promise<Blob> {
  onStatus("encoding", 30);
  const { ffmpeg, fetchFile } = await getFFmpeg();

  const inputName = videoBlob.type.includes("mp4")
    ? "input.mp4"
    : "input.webm";
  const tempFiles = [inputName, "output.mp4"];

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));

    onStatus("encoding", 50);

    await ffmpeg.exec([
      "-i", inputName,
      ...ENCODE_ARGS,
      "-movflags", "+faststart",
      "-y", "output.mp4",
    ]);

    const data = await ffmpeg.readFile("output.mp4");
    const result = new Blob([(data as Uint8Array).slice()], {
      type: "video/mp4",
    });

    onStatus("done", 100);
    return result;
  } finally {
    for (const f of tempFiles) {
      await ffmpeg.deleteFile(f).catch(() => {});
    }
  }
}
