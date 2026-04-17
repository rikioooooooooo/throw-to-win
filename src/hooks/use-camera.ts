"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// device-capability import removed — resolution/frameRate constraints are now
// hardcoded to avoid the tier-based 120fps that caused OverconstrainedError
// on ultra-wide cameras via iOS Safari WebKit.

/** Overlay renderer — draws onto the compositing canvas each frame */
export type OverlayRenderer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export type CameraLens = {
  readonly id: string;
  readonly label: string;
  /** Display label: "0.5x", "1x", "2x", "Front" etc. */
  readonly shortLabel: string;
  readonly isFront: boolean;
};

type UseCameraReturn = {
  videoRef: (node: HTMLVideoElement | null) => void;
  isRecording: boolean;
  videoBlob: Blob | null;
  recordedMimeType: string;
  availableLenses: readonly CameraLens[];
  activeLensId: string;
  /** Returns performance.now() when MediaRecorder actually started (live ref, not stale snapshot) */
  getRecordingStartTime: () => number;
  startPreview: (direction: "rear" | "front") => Promise<boolean>;
  startPreviewWithLens: (lensId: string) => Promise<boolean>;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  stopPreview: () => void;
  setOverlayRenderer: (renderer: OverlayRenderer | null) => void;
};

/** Convert iOS camera label to short display label */
function toLensShortLabel(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("ultra wide") || l.includes("ultrawide") || l.includes("\u8D85\u5E83\u89D2")) return "0.5x";
  if (l.includes("telephoto") || l.includes("\u671B\u9060")) return "2x";
  if (l.includes("front") || l.includes("facetime") || l.includes("\u524D\u9762")) return "Front";
  // "triple", "dual wide", "dual" are composite — skip showing them
  if (l.includes("triple") || l.includes("\u30C8\u30EA\u30D7\u30EB")) return "";
  if (l.includes("dual") || l.includes("\u30C7\u30E5\u30A2\u30EB")) return "";
  // Default rear camera = 1x
  if (l.includes("back") || l.includes("\u80CC\u9762") || l.includes("\u30AB\u30E1\u30E9")) return "1x";
  return label.slice(0, 6);
}

/** Feature-detect canvas captureStream support (missing on some iOS Safari) */
function canCaptureCanvas(): boolean {
  try {
    return typeof HTMLCanvasElement.prototype.captureStream === "function";
  } catch {
    return false;
  }
}

export function useCamera(): UseCameraReturn {
  const videoNodeRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("");
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState("");
  const [availableLenses, setAvailableLenses] = useState<readonly CameraLens[]>([]);
  const [activeLensId, setActiveLensId] = useState("");
  const recordingStartTimeRef = useRef(0);

  // Canvas compositing refs
  const overlayRendererRef = useRef<OverlayRenderer | null>(null);
  const compositingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCompositingRef = useRef(false);

  /** Stop the canvas compositing rAF + setInterval loop */
  const stopCompositing = () => {
    isCompositingRef.current = false;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  /** Apply stream to video element if both are available */
  const applyStream = useCallback(() => {
    const node = videoNodeRef.current;
    const stream = streamRef.current;
    if (node && stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play().catch(() => {});
    }
  }, []);

  /** Callback ref — auto-attaches stream when video element mounts */
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoNodeRef.current = node;
      if (node) applyStream();
    },
    [applyStream],
  );

  /** Set overlay renderer for canvas compositing */
  const setOverlayRenderer = useCallback(
    (renderer: OverlayRenderer | null) => {
      overlayRendererRef.current = renderer;
    },
    [],
  );

  const startPreview = useCallback(
    async (direction: "rear" | "front"): Promise<boolean> => {
      try {
        // Clean up prior session fully before starting new preview.
        // Without this, switching cameras mid-recording could leak
        // rAF/interval loops and leave recorder in invalid state.
        stopCompositing();
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        recorderRef.current = null;
        chunksRef.current = [];
        recordingStartTimeRef.current = 0;
        streamRef.current?.getTracks().forEach((t) => t.stop());

        // Get camera (grants permission + enables label access on iOS Safari).
        // Only constrain width — specifying BOTH width+height forces iOS Safari
        // to crop the sensor to that aspect ratio, narrowing the FOV significantly.
        // Omitting height lets the camera output its native aspect ratio (4:3 etc.)
        // which matches the native Camera app's field of view.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: direction === "rear" ? "environment" : "user",
            width: { ideal: 1920 },
            frameRate: { ideal: 60 },
          },
          audio: false,
        });

        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          for (const track of audioStream.getAudioTracks()) {
            stream.addTrack(track);
          }
        } catch {
          // Audio unavailable — proceed with video-only
        }

        // Enumerate devices and build lens list (labels available after permission)
        const currentTrack = stream.getVideoTracks()[0];
        let matchedLensId = currentTrack?.getSettings().deviceId ?? "";

        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter((d) => d.kind === "videoinput");
          const lenses: CameraLens[] = [];

          for (const d of videoDevices) {
            const short = toLensShortLabel(d.label);
            if (!short) continue; // Skip composites (triple, dual)
            lenses.push({
              id: d.deviceId,
              label: d.label,
              shortLabel: short,
              isFront: short === "Front",
            });
          }

          setAvailableLenses(lenses);

          // For rear camera, auto-switch to 0.5x (ultra-wide) if available.
          // Get new stream before stopping old (iOS Safari requirement).
          if (direction === "rear") {
            const ultraWide = lenses.find((l) => l.shortLabel === "0.5x");
            if (ultraWide) {
              try {
                const uwStream = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: ultraWide.id } },
                  audio: false,
                });
                try {
                  const uwAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
                  for (const track of uwAudio.getAudioTracks()) {
                    uwStream.addTrack(track);
                  }
                } catch { /* audio unavailable */ }
                stream.getTracks().forEach((t) => t.stop());
                const uwTrack = uwStream.getVideoTracks()[0];
                if (uwTrack) {
                  try {
                    await uwTrack.applyConstraints({
                      width: { ideal: 1920 },
                      frameRate: { ideal: 60 },
                    });
                  } catch { /* best-effort */ }
                }
                matchedLensId = ultraWide.id;
                streamRef.current = uwStream;
                setActiveLensId(matchedLensId);
                applyStream();
                return true;
              } catch {
                // Ultra-wide unavailable — fall through to default
              }
            }
          }

          // Fallback: match active lens to button highlight
          const directMatch = lenses.find((l) => l.id === matchedLensId);
          if (!directMatch) {
            const fallback = direction === "front"
              ? lenses.find((l) => l.isFront)
              : lenses.find((l) => l.shortLabel === "1x");
            if (fallback) matchedLensId = fallback.id;
          }
        } catch {
          setAvailableLenses([]);
        }

        setActiveLensId(matchedLensId);

        streamRef.current = stream;
        applyStream();

        return true;
      } catch {
        return false;
      }
    },
    [applyStream],
  );

  const startPreviewWithLens = useCallback(
    async (lensId: string): Promise<boolean> => {
      try {
        // iOS Safari (WebKit) rejects getUserMedia when deviceId: { exact }
        // is combined with frameRate/resolution constraints that the specific
        // camera can't satisfy (e.g. ultra-wide maxes at 30fps but high-tier
        // requests ideal: 120). Use ONLY deviceId to acquire the stream,
        // then tune resolution/frameRate via applyConstraints afterwards.
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: lensId } },
          audio: false,
        });
        try {
          const lensAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
          for (const track of lensAudio.getAudioTracks()) {
            newStream.addTrack(track);
          }
        } catch { /* audio unavailable */ }

        // Best-effort: request high resolution + frameRate without forcing aspect ratio.
        // Width-only keeps the camera's native aspect ratio → native FOV.
        const videoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            await videoTrack.applyConstraints({
              width: { ideal: 1920 },
              frameRate: { ideal: 60 },
            });
          } catch {
            // Some cameras may not support these — that's fine
          }
        }

        // New stream acquired — now clean up old
        stopCompositing();
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
          recorderRef.current.stop();
        }
        recorderRef.current = null;
        chunksRef.current = [];
        recordingStartTimeRef.current = 0;
        streamRef.current?.getTracks().forEach((t) => t.stop());

        if (videoTrack) {
          setActiveLensId(videoTrack.getSettings().deviceId ?? lensId);
        }

        streamRef.current = newStream;
        applyStream();
        return true;
      } catch {
        // getUserMedia failed — old stream was NOT stopped, camera keeps working
        return false;
      }
    },
    [applyStream],
  );

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    // Stop any prior compositing loop before starting fresh (prevents rAF/interval leak)
    stopCompositing();
    chunksRef.current = [];
    recordingStartTimeRef.current = 0;

    // Try canvas compositing to bake overlay into video frames.
    // Falls back to raw camera stream if captureStream is unavailable (iOS Safari).
    let recordStream: MediaStream = stream;

    if (canCaptureCanvas() && videoNodeRef.current) {
      try {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack?.getSettings();
        // Use video element's post-rotation dimensions for correct portrait orientation.
        // getSettings() returns raw sensor dimensions (often landscape), while
        // videoWidth/videoHeight reflect the actual displayed orientation.
        // Guard: videoWidth/videoHeight can be 0 if called before video metadata loads.
        const node = videoNodeRef.current;
        const rawW = node?.videoWidth || 0;
        const rawH = node?.videoHeight || 0;
        const width = rawW > 0 ? rawW : (settings?.width || 1080);
        const height = rawH > 0 ? rawH : (settings?.height || 1920);

        let canvas = compositingCanvasRef.current;
        if (!canvas) {
          canvas = document.createElement("canvas");
          compositingCanvasRef.current = canvas;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: false });

        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          // Start compositing: rAF loop (primary) + setInterval backup.
          // rAF stops when screen turns off (phone in air during throw),
          // so setInterval ensures canvas keeps updating for captureStream.
          isCompositingRef.current = true;

          // Throttle: rAF (~60fps) + setInterval (~30fps) can overlap,
          // causing up to 90 draws/sec. Track last draw time to cap at ~60fps.
          let lastDrawTime = 0;
          const DRAW_INTERVAL_MS = 16; // ~60fps cap

          const drawToCanvas = () => {
            const now = performance.now();
            if (now - lastDrawTime < DRAW_INTERVAL_MS) return;
            lastDrawTime = now;

            const node = videoNodeRef.current;
            if (node && node.readyState >= 2) {
              ctx.drawImage(node, 0, 0, width, height);
              if (overlayRendererRef.current) {
                overlayRendererRef.current(ctx, width, height);
              }
            }
          };

          const drawFrame = () => {
            if (!isCompositingRef.current) return;
            drawToCanvas();
            animationFrameRef.current = requestAnimationFrame(drawFrame);
          };
          animationFrameRef.current = requestAnimationFrame(drawFrame);

          // Backup: setInterval continues even when rAF is throttled
          // (screen off / page not visible during phone freefall)
          intervalRef.current = setInterval(() => {
            if (!isCompositingRef.current) return;
            drawToCanvas();
          }, 33); // ~30fps fallback

          // captureStream(60) = fixed 60fps output.
          // captureStream(0) is BROKEN for this use case: it only captures
          // frames when canvas is updated, but during freefall rAF stops
          // and no frames are produced → black/corrupt video.
          const canvasStream = canvas.captureStream(60);

          // Verify canvas stream actually has video tracks
          if (canvasStream.getVideoTracks().length > 0) {
            const compositedStream = new MediaStream();
            for (const track of canvasStream.getVideoTracks()) {
              compositedStream.addTrack(track);
            }
            for (const track of stream.getAudioTracks()) {
              compositedStream.addTrack(track);
            }
            recordStream = compositedStream;
          } else {
            // captureStream returned no video tracks — fall back
            stopCompositing();
          }
        }
      } catch {
        // Canvas compositing failed — fall back to raw stream
        stopCompositing();
      }
    }

    // Codec preference: MP4 (native iOS), then WebM (Android).
    // iOS Safari requires explicit AVC1 profile/level for reliable recording.
    const mimeTypes = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // iOS Safari optimal (Baseline 3.0 + AAC-LC)
      "video/mp4;codecs=avc1.42E01E",             // iOS Safari video-only
      "video/mp4;codecs=h264,aac",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    let mimeType = "";
    for (const mt of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mt)) {
        mimeType = mt;
        break;
      }
    }

    mimeTypeRef.current = mimeType;

    // Wrap MediaRecorder construction + start in try/catch.
    // iOS Safari can throw even when isTypeSupported() returns true.
    try {
      const recorder = new MediaRecorder(recordStream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 12_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // Record exact start time for accurate peak offset calculation
      recorder.onstart = () => {
        recordingStartTimeRef.current = performance.now();
      };

      // Error handler — prevent silent failure / permanent hang
      recorder.onerror = () => {
        stopCompositing();
        chunksRef.current = [];
        setIsRecording(false);
        recorderRef.current = null;
      };

      recorder.start(100);
      recorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      // MediaRecorder construction or start failed — clean up compositing
      stopCompositing();
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    stopCompositing();

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    return new Promise<Blob | null>((resolve) => {
      let resolved = false;

      const finalize = () => {
        if (resolved) return;
        resolved = true;
        const actualMime =
          recorder.mimeType || mimeTypeRef.current || "video/webm";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        setVideoBlob(blob);
        setRecordedMimeType(actualMime);
        setIsRecording(false);
        recorderRef.current = null;
        resolve(blob);
      };

      // Safety timeout — prevent permanent hang if recorder never fires onstop
      const timeout = setTimeout(finalize, 5000);

      recorder.onstop = () => {
        clearTimeout(timeout);
        finalize();
      };

      try {
        recorder.stop();
      } catch {
        clearTimeout(timeout);
        finalize();
      }
    });
  }, []);

  const stopPreview = useCallback(() => {
    stopCompositing();

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoNodeRef.current) {
      videoNodeRef.current.srcObject = null;
    }
  }, []);

  // Cleanup on unmount — prevent MediaRecorder, rAF, and interval leaks
  useEffect(() => {
    return () => {
      isCompositingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // getRecordingStartTime is a GETTER — returns live ref value, not a stale
  // render-time snapshot. This is critical: recordingStartTimeRef.current is
  // set in recorder.onstart (async), so returning the raw value at render
  // time would always be 0, making peakOffset absurdly large → ffmpeg garbage.
  const getRecordingStartTime = useCallback(
    () => recordingStartTimeRef.current,
    [],
  );

  return {
    videoRef,
    isRecording,
    videoBlob,
    recordedMimeType,
    availableLenses,
    activeLensId,
    getRecordingStartTime,
    startPreview,
    startPreviewWithLens,
    startRecording,
    stopRecording,
    stopPreview,
    setOverlayRenderer,
  };
}
