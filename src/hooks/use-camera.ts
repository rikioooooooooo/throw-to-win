"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectCapabilities, CAMERA_CONSTRAINTS } from "@/lib/device-capability";

/** Overlay renderer — draws onto the compositing canvas each frame */
export type OverlayRenderer = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

type UseCameraReturn = {
  videoRef: (node: HTMLVideoElement | null) => void;
  isRecording: boolean;
  videoBlob: Blob | null;
  recordedMimeType: string;
  /** Returns performance.now() when MediaRecorder actually started (live ref, not stale snapshot) */
  getRecordingStartTime: () => number;
  startPreview: (direction: "rear" | "front") => Promise<boolean>;
  startRecording: () => void;
  stopRecording: () => Promise<Blob | null>;
  stopPreview: () => void;
  setOverlayRenderer: (renderer: OverlayRenderer | null) => void;
};

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

        const caps = detectCapabilities();
        const constraints = CAMERA_CONSTRAINTS[caps.tier];

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: direction === "rear" ? "environment" : "user",
            width: { ideal: constraints.width },
            height: { ideal: constraints.height },
            frameRate: { ideal: constraints.frameRate, min: 30 },
          },
          audio: true,
        });

        // Store stream and attach to video element FIRST (prevents black screen)
        streamRef.current = stream;
        applyStream();

        // THEN try to zoom out to ultra-wide (0.5x on iPhones)
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && direction === "rear") {
          try {
            const trackCaps = videoTrack.getCapabilities?.() as
              | (MediaTrackCapabilities & {
                  zoom?: { min: number; max: number };
                })
              | undefined;

            if (trackCaps?.zoom && trackCaps.zoom.min < 1) {
              const ultraWideZoom = Math.max(trackCaps.zoom.min, 0.5);
              await videoTrack.applyConstraints({
                advanced: [
                  { zoom: ultraWideZoom } as MediaTrackConstraintSet,
                ],
              });
            } else if (trackCaps?.zoom) {
              await videoTrack.applyConstraints({
                advanced: [
                  { zoom: trackCaps.zoom.min } as MediaTrackConstraintSet,
                ],
              });
            }
          } catch {
            // zoom constraint not supported, keep default
          }
        }

        return true;
      } catch {
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
    getRecordingStartTime,
    startPreview,
    startRecording,
    stopRecording,
    stopPreview,
    setOverlayRenderer,
  };
}
