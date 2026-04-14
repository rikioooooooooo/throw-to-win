"use client";

import { useState, useCallback, useRef } from "react";
import { detectCapabilities, CAMERA_CONSTRAINTS } from "@/lib/device-capability";
import { calculateHeight, formatHeight } from "@/lib/physics";
import { processVideo, preloadFFmpeg } from "@/lib/video-processor";

// ============================================================
// Device Test Page — runs on real device, reports results
// ============================================================

type TestStatus = "pending" | "running" | "pass" | "fail" | "warn" | "skip";

type TestResult = {
  readonly name: string;
  readonly status: TestStatus;
  readonly detail: string;
  readonly duration?: number;
};

type TestFn = () => Promise<{
  status: TestStatus;
  detail: string;
}>;

/** Shared state between tests */
type TestContext = {
  stream: MediaStream | null;
  videoBlob: Blob | null;
  videoEl: HTMLVideoElement | null;
};

export default function TestPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const ctxRef = useRef<TestContext>({
    stream: null,
    videoBlob: null,
    videoEl: null,
  });

  const updateResult = useCallback(
    (index: number, update: Partial<TestResult>) => {
      setResults((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...update };
        return next;
      });
    },
    [],
  );

  // ---- Test definitions ----

  const testDeviceCapability: TestFn = async () => {
    const caps = detectCapabilities();
    const cores = navigator.hardwareConcurrency ?? "unknown";
    // @ts-expect-error -- deviceMemory not in TS types
    const mem = navigator.deviceMemory ?? "N/A";
    const constraints = CAMERA_CONSTRAINTS[caps.tier];

    const lines = [
      `Tier: ${caps.tier} | Cores: ${cores} | Memory: ${mem}GB`,
      `Camera: ${constraints.width}x${constraints.height} @ ${constraints.frameRate}fps`,
      `Motion: ${caps.hasMotionSensor} | Camera: ${caps.hasCamera}`,
      `MediaRecorder: ${caps.hasMediaRecorder} | SAB: ${caps.supportsSharedArrayBuffer}`,
    ];

    const isMissing = !caps.hasCamera || !caps.hasMotionSensor || !caps.hasMediaRecorder;
    return {
      status: isMissing ? "warn" : "pass",
      detail: lines.join("\n"),
    };
  };

  const testPhysics: TestFn = async () => {
    // h = g * t^2 / 8
    // t=1s → h = 9.81 * 1 / 8 = 1.226m
    const h1 = calculateHeight(1.0);
    const ok1 = Math.abs(h1 - 1.22625) < 0.001;

    // t=2s → h = 9.81 * 4 / 8 = 4.905m
    const h2 = calculateHeight(2.0);
    const ok2 = Math.abs(h2 - 4.905) < 0.001;

    // t=0 → h = 0
    const h0 = calculateHeight(0);
    const ok0 = h0 === 0;

    // negative → 0
    const hN = calculateHeight(-1);
    const okN = hN === 0;

    // formatHeight
    const f = formatHeight(1.22625);
    const okF = f === "1.23";

    const all = ok1 && ok2 && ok0 && okN && okF;
    return {
      status: all ? "pass" : "fail",
      detail: [
        `h(1.0s) = ${h1.toFixed(4)}m ${ok1 ? "OK" : "FAIL (expect 1.2263)"}`,
        `h(2.0s) = ${h2.toFixed(4)}m ${ok2 ? "OK" : "FAIL (expect 4.905)"}`,
        `h(0) = ${h0} ${ok0 ? "OK" : "FAIL"}`,
        `h(-1) = ${hN} ${okN ? "OK" : "FAIL"}`,
        `format(1.22625) = "${f}" ${okF ? "OK" : "FAIL"}`,
      ].join("\n"),
    };
  };

  const testCameraAccess: TestFn = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return { status: "fail", detail: "getUserMedia not available" };
    }

    const caps = detectCapabilities();
    const constraints = CAMERA_CONSTRAINTS[caps.tier];

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: constraints.width },
        height: { ideal: constraints.height },
        frameRate: { ideal: constraints.frameRate, min: 30 },
      },
      audio: true,
    });

    ctxRef.current.stream = stream;

    const vTrack = stream.getVideoTracks()[0];
    const settings = vTrack.getSettings();
    const aTrack = stream.getAudioTracks()[0];

    // Check zoom capabilities
    let zoomInfo = "N/A";
    try {
      const trackCaps = vTrack.getCapabilities?.() as
        | (MediaTrackCapabilities & { zoom?: { min: number; max: number } })
        | undefined;
      if (trackCaps?.zoom) {
        zoomInfo = `${trackCaps.zoom.min}x - ${trackCaps.zoom.max}x`;
      }
    } catch {
      zoomInfo = "not supported";
    }

    // Check portrait
    const w = settings.width ?? 0;
    const h = settings.height ?? 0;
    const isPortrait = h > w;

    const fps = settings.frameRate ?? 0;
    const fpsOk = fps >= 55; // Allow some tolerance

    return {
      status: fpsOk ? "pass" : "warn",
      detail: [
        `Resolution: ${w}x${h} ${isPortrait ? "(portrait)" : "(LANDSCAPE)"}`,
        `FrameRate: ${fps?.toFixed(1)}fps ${fpsOk ? "OK" : "< 60fps!"}`,
        `Zoom range: ${zoomInfo}`,
        `Audio: ${aTrack ? `${aTrack.label}` : "none"}`,
        `Facing: ${settings.facingMode ?? "unknown"}`,
      ].join("\n"),
    };
  };

  const testCanvasCompositing: TestFn = async () => {
    const stream = ctxRef.current.stream;
    if (!stream) return { status: "skip", detail: "No camera stream (prev test failed)" };

    // Check captureStream support
    const hasCaptureStream =
      typeof HTMLCanvasElement.prototype.captureStream === "function";
    if (!hasCaptureStream) {
      return { status: "warn", detail: "captureStream not supported — overlay won't bake into video" };
    }

    // Create video element
    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();

    // Wait for video dimensions
    await new Promise<void>((resolve) => {
      const check = () => {
        if (video.videoWidth > 0) resolve();
        else requestAnimationFrame(check);
      };
      check();
    });

    ctxRef.current.videoEl = video;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const isPortrait = vh > vw;

    // Create compositing canvas
    const canvas = document.createElement("canvas");
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext("2d", { alpha: false })!;

    // Test compositing: draw video + overlay
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.fillStyle = "#ff2d2d";
    ctx.font = `bold ${Math.round(vw * 0.07)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("TEST", vw / 2, vh * 0.08);

    // Start recording via canvas captureStream
    const canvasStream = canvas.captureStream(120);
    const compositedStream = new MediaStream();
    for (const t of canvasStream.getVideoTracks()) compositedStream.addTrack(t);
    for (const t of stream.getAudioTracks()) compositedStream.addTrack(t);

    // Find supported mime type
    const mimeTypes = [
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    let mime = "";
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) { mime = mt; break; }
    }

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(compositedStream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 12_000_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Record 3 seconds with compositing loop
    let animFrame = 0;
    const drawLoop = () => {
      ctx.drawImage(video, 0, 0, vw, vh);
      ctx.fillStyle = "rgba(255, 45, 45, 0.8)";
      ctx.font = `bold ${Math.round(vw * 0.07)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("2.45m", vw / 2, vh * 0.08);
      animFrame = requestAnimationFrame(drawLoop);
    };

    recorder.start(100);
    animFrame = requestAnimationFrame(drawLoop);

    await new Promise((r) => setTimeout(r, 3000));

    cancelAnimationFrame(animFrame);

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const actualMime = recorder.mimeType || mime || "video/webm";
        resolve(new Blob(chunks, { type: actualMime }));
      };
      recorder.stop();
    });

    ctxRef.current.videoBlob = blob;

    const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
    const isOk = blob.size > 10000;

    return {
      status: isOk ? "pass" : "fail",
      detail: [
        `Canvas: ${vw}x${vh} ${isPortrait ? "(portrait)" : "(LANDSCAPE!)"}`,
        `Video element: ${video.videoWidth}x${video.videoHeight}`,
        `Blob: ${sizeMB}MB (${blob.type})`,
        `Mime: ${mime}`,
        `captureStream(120): ${canvasStream.getVideoTracks().length} tracks`,
      ].join("\n"),
    };
  };

  const testVideoProcessing: TestFn = async () => {
    const blob = ctxRef.current.videoBlob;
    if (!blob || blob.size < 1000) {
      return { status: "skip", detail: "No test video from canvas compositing test" };
    }

    // Process with ffmpeg (slow-mo at 1.5s peak offset)
    const peakOffset = 1.5;
    let lastStatus = "";

    const result = await processVideo(blob, {
      peakTimeOffset: peakOffset,
      onStatus: (status, progress) => {
        lastStatus = `${status} ${progress ?? ""}%`;
      },
    });

    const inputMB = (blob.size / (1024 * 1024)).toFixed(2);
    const outputMB = (result.size / (1024 * 1024)).toFixed(2);
    const isMP4 = result.type.includes("mp4");
    const sizeOk = result.size > 1000;
    const notTruncated = result.size > blob.size * 0.3; // Should be at least 30% of input

    const allOk = isMP4 && sizeOk && notTruncated;

    return {
      status: allOk ? "pass" : result === blob ? "warn" : "fail",
      detail: [
        `Input: ${inputMB}MB (${blob.type})`,
        `Output: ${outputMB}MB (${result.type})`,
        `MP4: ${isMP4 ? "YES" : "NO"}`,
        `Size ratio: ${((result.size / blob.size) * 100).toFixed(0)}%`,
        `Not truncated: ${notTruncated ? "OK" : "FAIL (< 30% of input)"}`,
        `Last status: ${lastStatus}`,
        `Fallback used: ${result === blob}`,
      ].join("\n"),
    };
  };

  const testAccelerometer: TestFn = async () => {
    if (typeof DeviceMotionEvent === "undefined") {
      return { status: "fail", detail: "DeviceMotionEvent not available" };
    }

    // Request permission on iOS
    if (
      "requestPermission" in DeviceMotionEvent &&
      typeof (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> })
        .requestPermission === "function"
    ) {
      try {
        const state = await (
          DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (state !== "granted") {
          return { status: "fail", detail: `Permission: ${state}` };
        }
      } catch (e) {
        return { status: "fail", detail: `Permission error: ${e}` };
      }
    }

    // Collect samples for 1 second
    const samples: number[] = [];
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (a?.x != null && a?.y != null && a?.z != null) {
        samples.push(Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2));
      }
    };

    window.addEventListener("devicemotion", handler);
    await new Promise((r) => setTimeout(r, 1000));
    window.removeEventListener("devicemotion", handler);

    if (samples.length === 0) {
      return { status: "fail", detail: "No accelerometer data received" };
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const hz = samples.length; // samples per second
    const nearGravity = Math.abs(avg - 9.81) < 3;

    return {
      status: nearGravity ? "pass" : "warn",
      detail: [
        `Samples: ${samples.length} (${hz}Hz)`,
        `Avg magnitude: ${avg.toFixed(2)} m/s^2 ${nearGravity ? "(~gravity)" : "(unusual)"}`,
        `Min: ${Math.min(...samples).toFixed(2)} | Max: ${Math.max(...samples).toFixed(2)}`,
      ].join("\n"),
    };
  };

  // ---- Test runner ----

  const tests: { name: string; fn: TestFn }[] = [
    { name: "Device Capability", fn: testDeviceCapability },
    { name: "Physics", fn: testPhysics },
    { name: "Camera Access", fn: testCameraAccess },
    { name: "Canvas Compositing (3s rec)", fn: testCanvasCompositing },
    { name: "ffmpeg.wasm Slow-Mo", fn: testVideoProcessing },
    { name: "Accelerometer", fn: testAccelerometer },
  ];

  const runTests = useCallback(async () => {
    setRunning(true);
    setVideoPreviewUrl(null);

    // Cleanup previous
    ctxRef.current.stream?.getTracks().forEach((t) => t.stop());
    ctxRef.current = { stream: null, videoBlob: null, videoEl: null };

    // Preload ffmpeg
    preloadFFmpeg();

    // Initialize results
    const initial: TestResult[] = tests.map((t) => ({
      name: t.name,
      status: "pending" as const,
      detail: "",
    }));
    setResults(initial);

    // Run sequentially
    for (let i = 0; i < tests.length; i++) {
      updateResult(i, { status: "running", detail: "..." });
      const start = performance.now();
      try {
        const { status, detail } = await tests[i].fn();
        const duration = Math.round(performance.now() - start);
        updateResult(i, { status, detail, duration });
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        updateResult(i, {
          status: "fail",
          detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
          duration,
        });
      }
    }

    // Create preview URL for the recorded video
    if (ctxRef.current.videoBlob) {
      setVideoPreviewUrl(URL.createObjectURL(ctxRef.current.videoBlob));
    }

    // Cleanup camera
    ctxRef.current.stream?.getTracks().forEach((t) => t.stop());
    ctxRef.current.videoEl?.pause();

    setRunning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateResult]);

  // ---- Render ----

  const statusColor = (s: TestStatus) => {
    switch (s) {
      case "pass": return "text-green-400";
      case "fail": return "text-red-400";
      case "warn": return "text-yellow-400";
      case "running": return "text-blue-400";
      case "skip": return "text-muted/50";
      default: return "text-muted/30";
    }
  };

  const statusIcon = (s: TestStatus) => {
    switch (s) {
      case "pass": return "[OK]";
      case "fail": return "[FAIL]";
      case "warn": return "[WARN]";
      case "running": return "[...]";
      case "skip": return "[SKIP]";
      default: return "[--]";
    }
  };

  return (
    <main className="fixed inset-0 bg-black text-white overflow-y-auto">
      <div className="p-4 pb-20 safe-top safe-bottom max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-[18px] font-black tracking-[0.15em] uppercase">
            Device Test
          </h1>
          <span className="text-muted/30 text-[10px] font-mono">
            {typeof navigator !== "undefined"
              ? navigator.userAgent.slice(0, 40)
              : ""}
          </span>
        </div>

        {/* Test results */}
        <div className="flex flex-col gap-2 mb-6">
          {results.map((r, i) => (
            <div
              key={i}
              className="p-3 bg-surface border border-white/[0.04] rounded-sm"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-[12px] font-bold tracking-wide">
                  {r.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {r.duration !== undefined && (
                    <span className="text-[9px] text-muted/30 font-mono tabular-nums">
                      {r.duration}ms
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold font-mono ${statusColor(r.status)}`}
                  >
                    {statusIcon(r.status)}
                  </span>
                </div>
              </div>
              {r.detail && (
                <pre className="text-[10px] text-muted/60 mt-2 whitespace-pre-wrap font-mono leading-relaxed">
                  {r.detail}
                </pre>
              )}
            </div>
          ))}
        </div>

        {/* Video preview */}
        {videoPreviewUrl && (
          <div className="mb-6">
            <p className="text-[10px] text-muted/40 tracking-widest uppercase mb-2">
              Recorded Test Video
            </p>
            <video
              src={videoPreviewUrl}
              controls
              playsInline
              muted
              className="w-full max-w-[240px] aspect-[9/16] bg-surface border border-white/[0.04] object-cover"
            />
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runTests}
          disabled={running}
          className={`w-full py-4 text-[13px] font-black tracking-[0.3em] uppercase transition-all duration-100 ${
            running
              ? "bg-surface text-muted cursor-wait"
              : "bg-accent text-white active:scale-[0.97] shadow-[0_0_40px_rgba(255,45,45,0.25)]"
          }`}
        >
          {running ? "RUNNING..." : results.length > 0 ? "RE-RUN TESTS" : "RUN TESTS"}
        </button>

        {/* Summary */}
        {!running && results.length > 0 && (
          <div className="mt-4 text-center">
            <span className="text-[11px] text-muted/40 tracking-wide">
              {results.filter((r) => r.status === "pass").length}/{results.length} passed
              {results.some((r) => r.status === "fail") && (
                <span className="text-red-400 ml-2">
                  {results.filter((r) => r.status === "fail").length} failed
                </span>
              )}
              {results.some((r) => r.status === "warn") && (
                <span className="text-yellow-400 ml-2">
                  {results.filter((r) => r.status === "warn").length} warnings
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </main>
  );
}
