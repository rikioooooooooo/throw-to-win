"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { useThrowDetection } from "@/hooks/use-throw-detection";
import { useCamera, type OverlayRenderer } from "@/hooks/use-camera";
import { hasValidConsent, addThrowRecord } from "@/lib/storage";
import { downloadBlob, shareNative, shareTo } from "@/lib/share";
import { processVideo, preloadFFmpeg } from "@/lib/video-processor";
import { formatHeight, GRAVITY } from "@/lib/physics";
import type { ThrowResult, VideoProcessingStatus } from "@/lib/types";
import { PermissionRequest } from "@/components/permission-request";
import { Countdown, type CountdownStep } from "@/components/countdown";
import { HeightDisplay } from "@/components/height-display";
import { LoadingScreen } from "@/components/loading-screen";
import { SlowMoPlayer } from "@/components/slow-mo-player";

type GameState =
  | "permissions"
  | "prepare"
  | "countdown"
  | "active"
  | "processing"
  | "done";

export default function PlayPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  const [gameState, setGameState] = useState<GameState>("permissions");
  const [processingStatus, setProcessingStatus] =
    useState<VideoProcessingStatus>("idle");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [resultData, setResultData] = useState<{
    height: number;
    airtime: number;
    isPersonalBest: boolean;
    videoBlob: Blob | null;
    /** Peak time offset from recording start (seconds) — for SlowMoPlayer */
    peakOffset: number;
    /** Whether ffmpeg slow-mo was applied (if true, skip JS slow-mo) */
    ffmpegProcessed: boolean;
  } | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [peakResult, setPeakResult] = useState<ThrowResult | null>(null);

  const {
    phase,
    result,
    realtimeHeight,
    getFreefallStartTime,
    getEstimatedV0,
    startCalibration,
    startDetection,
    reset: resetDetection,
  } = useThrowDetection();

  const {
    videoRef,
    isRecording,
    availableLenses,
    activeLensId,
    getRecordingStartTime,
    startPreview,
    startPreviewWithLens,
    startRecording,
    stopRecording,
    stopPreview,
    setOverlayRenderer,
  } = useCamera();
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const finishingRef = useRef(false);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayStateRef = useRef<{
    mode: "idle" | "countdown" | "height";
    countdownText: string;
    height: number;
    isAtPeak: boolean;
    /** Trajectory simulation: v₀ from launch-phase integration */
    estimatedV0: number;
    freefallStartTime: number;
    /** Tracks max displayed height — only goes UP, freezes at peak */
    maxDisplayedHeight: number;
    /** Landing correction: smooth from estimated to true peak */
    correctionStartTime: number;
    correctionFrom: number;
    correctionTo: number;
  }>({
    mode: "idle",
    countdownText: "",
    height: 0,
    isAtPeak: false,
    estimatedV0: 0,
    freefallStartTime: 0,
    maxDisplayedHeight: 0,
    correctionStartTime: 0,
    correctionFrom: 0,
    correctionTo: 0,
  });

  // ---- Overlay renderer (canvas compositing for video baking) ----
  const overlayRenderer = useCallback<OverlayRenderer>((ctx, w, h) => {
    const state = overlayStateRef.current;

    if (state.mode === "countdown") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, w, h);

      const fontSize = Math.round(w * 0.35);
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = Math.round(w * 0.03);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(w * 0.005);
      ctx.fillStyle = "#ffffff";
      ctx.font = `900 ${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.countdownText, w / 2, h / 2);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      return;
    }

    if (state.mode === "height") {
      const CORRECTION_MS = 200;
      let displayHeight: number;
      let useAccentColor: boolean;

      if (state.correctionStartTime > 0) {
        // Post-landing correction to true peak.
        // If overestimated (estimated > true): snap immediately to true peak
        // to avoid the jarring "number going down" effect.
        // If underestimated (estimated < true): smooth easeOut upward.
        if (state.correctionFrom > state.correctionTo) {
          // Overestimate: snap to true value immediately
          displayHeight = state.correctionTo;
          useAccentColor = true;
        } else {
          const elapsed = performance.now() - state.correctionStartTime;
          const progress = Math.min(elapsed / CORRECTION_MS, 1);
          const eased = 1 - (1 - progress) * (1 - progress);
          displayHeight = state.correctionFrom + (state.correctionTo - state.correctionFrom) * eased;
          useAccentColor = progress >= 1;
        }
      } else if (state.freefallStartTime > 0 && state.estimatedV0 > 0) {
        // v₀-based trajectory: h(t) = v₀t - gt²/2
        // Tracks actual phone altitude during freefall (fast rise → peak → fall).
        // maxDisplayedHeight freezes at peak so the number never drops.
        const t = Math.min((performance.now() - state.freefallStartTime) / 1000, 4.0);
        const h_t = state.estimatedV0 * t - (GRAVITY * t * t) / 2;
        const clamped = Math.max(0, h_t);
        if (clamped > state.maxDisplayedHeight) {
          state.maxDisplayedHeight = clamped;
        }
        displayHeight = state.maxDisplayedHeight;
        useAccentColor = false;
      } else {
        displayHeight = state.height;
        useAccentColor = state.isAtPeak;
      }

      const heightStr = formatHeight(displayHeight);
      const numSize = Math.round(w * 0.07);
      const unitSize = Math.round(numSize * 0.55);
      const y = h * 0.08;

      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = Math.round(w * 0.015);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(w * 0.003);

      ctx.font = `900 ${numSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const numWidth = ctx.measureText(heightStr).width;
      ctx.font = `700 ${unitSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const mWidth = ctx.measureText("m").width;
      const gap = numSize * 0.1;
      const totalW = numWidth + gap + mWidth;
      const startX = (w - totalW) / 2;

      ctx.fillStyle = useAccentColor ? "#ff2d2d" : "#ffffff";
      ctx.font = `900 ${numSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(heightStr, startX, y);

      ctx.fillStyle = useAccentColor
        ? "rgba(255, 45, 45, 0.6)"
        : "rgba(255, 255, 255, 0.4)";
      ctx.font = `700 ${unitSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillText("m", startX + numWidth + gap, y);

      const wmSize = Math.round(w * 0.022);
      ctx.shadowBlur = Math.round(w * 0.005);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = `600 ${wmSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(
        "THROW TO WIN",
        w - Math.round(w * 0.03),
        h - Math.round(h * 0.015),
      );

      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  }, []);

  // ---- Overlay state sync ----
  // When freefall starts: set trajectory params (v₀ + startTime) for live simulation.
  // The renderer computes h(t) = v₀t - gt²/2 and tracks max (freezes at peak).
  // Landing correction is set synchronously in the result handler.
  useEffect(() => {
    // Guard: don't overwrite correction state set by the result handler.
    // Check both peakResult (state, may lag one render) and finishingRef (sync ref).
    if (peakResult || finishingRef.current) return;
    if (gameState === "active" && phase === "freefall") {
      const t0 = getFreefallStartTime();
      const v0 = getEstimatedV0();
      if (t0 > 0) {
        overlayStateRef.current = {
          mode: "height",
          countdownText: "",
          height: 0,
          isAtPeak: false,
          estimatedV0: v0,
          freefallStartTime: t0,
          maxDisplayedHeight: 0,
          correctionStartTime: 0,
          correctionFrom: 0,
          correctionTo: 0,
        };
        return;
      }
    }
    if (gameState === "countdown") return;
    overlayStateRef.current = {
      mode: "idle",
      countdownText: "",
      height: 0,
      isAtPeak: false,
      estimatedV0: 0,
      freefallStartTime: 0,
      maxDisplayedHeight: 0,
      correctionStartTime: 0,
      correctionFrom: 0,
      correctionTo: 0,
    };
  }, [peakResult, phase, gameState, getFreefallStartTime, getEstimatedV0]);

  const handleCountdownTick = useCallback((step: CountdownStep) => {
    if (step === "done") return;
    const base = {
      height: 0,
      isAtPeak: false,
      estimatedV0: 0,
      freefallStartTime: 0,
      maxDisplayedHeight: 0,
      correctionStartTime: 0,
      correctionFrom: 0,
      correctionTo: 0,
    };
    if (typeof step === "number") {
      overlayStateRef.current = { mode: "countdown", countdownText: String(step), ...base };
    } else {
      overlayStateRef.current = { mode: "idle", countdownText: "", ...base };
    }
  }, []);

  // Preload ffmpeg
  useEffect(() => {
    preloadFFmpeg();
  }, []);

  // Cleanup Wake Lock on unmount
  useEffect(() => {
    return () => {
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // Redirect if no consent
  useEffect(() => {
    if (!hasValidConsent()) {
      router.replace(`/${locale}`);
    }
  }, [router, locale]);

  // ---- Handle throw result ----
  // At landing: flash peak height in red and FREEZE. The overlay sync useEffect
  // sets isAtPeak=true which stops live computation and locks the display.
  // Recording continues for 5 seconds to capture the catch moment.
  useEffect(() => {
    if (result && gameState === "active" && !finishingRef.current) {
      finishingRef.current = true;

      // Landing: if v₀ trajectory was active, the tracked max IS the result.
      // No correction needed — just freeze at the displayed max (red flash).
      // If v₀ estimation failed (maxDisplayedHeight=0), fall back to airtime-based.
      const trackedMax = overlayStateRef.current.maxDisplayedHeight;
      const finalHeight = trackedMax > 0 ? trackedMax : result.heightMeters;
      const displayResult: ThrowResult = trackedMax > 0
        ? { ...result, heightMeters: finalHeight }
        : result;

      // Set peak with unified height — DOM HeightDisplay and canvas overlay match.
      setPeakResult(displayResult);

      overlayStateRef.current = {
        mode: "height",
        countdownText: "",
        height: finalHeight,
        isAtPeak: true,
        estimatedV0: 0,
        freefallStartTime: 0,
        maxDisplayedHeight: 0,
        correctionStartTime: 0,
        correctionFrom: 0,
        correctionTo: 0,
      };

      // Wait 5 seconds then stop recording and process video.
      finishTimeoutRef.current = setTimeout(() => {
        finishTimeoutRef.current = null;
        handleThrowComplete(displayResult);
      }, 5000);
    }
    return () => {
      if (finishTimeoutRef.current) {
        clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, gameState]);

  // Create/revoke video URL
  useEffect(() => {
    if (resultData?.videoBlob) {
      const url = URL.createObjectURL(resultData.videoBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setVideoUrl(null);
  }, [resultData?.videoBlob]);

  const handlePermissionsGranted = useCallback(async () => {
    const success = await startPreview("rear");
    if (success) {
      setGameState("prepare");
    }
  }, [startPreview]);

  const handleStartCountdown = useCallback(async () => {
    setGameState("countdown");
    startCalibration();
    setOverlayRenderer(overlayRenderer);
    startRecording();

    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      // Wake Lock not supported
    }
  }, [startCalibration, startRecording, setOverlayRenderer, overlayRenderer]);

  const handleCountdownComplete = useCallback(() => {
    setGameState("active");
    startDetection();
  }, [startDetection]);

  const handleThrowComplete = useCallback(
    async (throwResult: ThrowResult) => {
      setGameState("processing");

      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;

      const videoBlob = await stopRecording();

      const data = addThrowRecord(
        throwResult.heightMeters,
        throwResult.airtimeSeconds,
      );
      const isPersonalBest =
        throwResult.heightMeters >= data.stats.personalBest;

      const peakOffset =
        (throwResult.peakTime - getRecordingStartTime()) / 1000;

      let processedBlob: Blob | null = null;
      let ffmpegProcessed = false;
      if (videoBlob) {
        try {
          processedBlob = await processVideo(videoBlob, {
            peakTimeOffset: peakOffset,
            onStatus: (status, progress) => {
              setProcessingStatus(status);
              if (progress !== undefined) setProcessingProgress(progress);
            },
          });
          ffmpegProcessed =
            processedBlob !== videoBlob &&
            processedBlob.type.includes("mp4");
        } catch {
          processedBlob = videoBlob;
        }
      }

      setResultData({
        height: throwResult.heightMeters,
        airtime: throwResult.airtimeSeconds,
        isPersonalBest,
        videoBlob: processedBlob,
        peakOffset,
        ffmpegProcessed,
      });

      stopPreview();
      resetDetection();
      setGameState("done");
    },
    [stopRecording, stopPreview, resetDetection, getRecordingStartTime],
  );

  const handleTryAgain = useCallback(async () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    finishingRef.current = false;
    setResultData(null);
    setVideoUrl(null);
    setPeakResult(null);
    setProcessingStatus("idle");
    setProcessingProgress(0);
    // Restart camera preview (re-enumerates lenses)
    const success = await startPreview("rear");
    setGameState(success ? "prepare" : "permissions");
  }, [startPreview]);

  const handleSaveVideo = useCallback(async () => {
    if (!resultData?.videoBlob) return;
    const ext = resultData.videoBlob.type.includes("mp4") ? "mp4" : "webm";
    const name = `throw-${formatHeight(resultData.height)}m.${ext}`;

    if (navigator.share) {
      try {
        const file = new File([resultData.videoBlob], name, {
          type: resultData.videoBlob.type,
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      } catch {
        /* user cancelled */
      }
    }

    downloadBlob(resultData.videoBlob, name);
  }, [resultData]);

  const handleShareVideo = useCallback(async () => {
    if (!resultData?.videoBlob) return;
    const shared = await shareNative(
      resultData.videoBlob,
      resultData.height,
      locale,
    );
    if (!shared) {
      shareTo("x", resultData.videoBlob, resultData.height, locale);
    }
  }, [resultData, locale]);

  // ---- Render by game state ----

  if (gameState === "permissions") {
    return <PermissionRequest onGranted={handlePermissionsGranted} />;
  }

  // Unified camera view — single persistent <video> across prepare/countdown/active
  if (
    gameState === "prepare" ||
    gameState === "countdown" ||
    gameState === "active"
  ) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* Persistent video element */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* REC indicator — glass pill */}
        {isRecording && (
          <div className="absolute left-4 z-20 flex items-center gap-2 glass px-3 py-1.5 border border-border" style={{ top: "max(1rem, env(safe-area-inset-top, 48px))" }}>
            <span className="w-2 h-2 rounded-full bg-accent animate-rec" />
            <span className="text-accent/60 text-[10px] font-display tracking-widest uppercase">
              REC
            </span>
          </div>
        )}

        {/* ---- Prepare overlay ---- */}
        {gameState === "prepare" && (
          <>
            {/* Lens picker */}
            {availableLenses.length > 0 && (
              <div
                className="absolute top-0 inset-x-0 z-20 flex justify-center gap-1.5 px-4 pt-3 safe-top"
              >
                {availableLenses.map((lens) => (
                  <button
                    key={lens.id}
                    onClick={() => startPreviewWithLens(lens.id)}
                    className={`min-w-[48px] h-9 px-3 text-[11px] font-display font-bold tracking-wider uppercase transition-all duration-150 ${
                      activeLensId === lens.id
                        ? "bg-white/15 text-white border border-white/30 backdrop-blur-md"
                        : "text-white/40 border border-white/[0.08] backdrop-blur-sm active:scale-90"
                    }`}
                  >
                    {lens.shortLabel}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom CTA with gradient fade */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-6 pb-8 safe-bottom bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <p className="text-white/30 text-[11px] tracking-[0.2em] text-center mb-6 uppercase text-camera">
                {t("prepare.instruction")}
              </p>
              <button
                onClick={handleStartCountdown}
                className="w-full py-5 bg-accent text-white font-display text-[16px] font-black tracking-[0.3em] uppercase shadow-[0_0_40px_rgba(255,45,45,0.3)] active:scale-[0.97] transition-transform duration-100 relative overflow-hidden group"
              >
                <span className="relative z-10">{t("prepare.startButton")}</span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-active:translate-y-0 transition-transform duration-200 ease-out" />
              </button>
            </div>
          </>
        )}

        {/* ---- Countdown overlay ---- */}
        {gameState === "countdown" && (
          <Countdown
            onComplete={handleCountdownComplete}
            onTick={handleCountdownTick}
          />
        )}

        {/* ---- Active throw overlay ---- */}
        {gameState === "active" && (
          <>
            <HeightDisplay
              height={
                peakResult ? peakResult.heightMeters : realtimeHeight
              }
              isAtPeak={!!peakResult}
            />

            {/* Phase status badges */}
            {!peakResult && (
              <>
                {phase === "freefall" && (
                  <div className="absolute top-4 right-4 safe-top z-30 glass px-3 py-1.5 border border-accent text-accent font-display text-[10px] tracking-widest uppercase text-glow animate-pulse-red">
                    {t("game.freefall")}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-28 z-30 text-center safe-bottom">
                  {(phase === "waiting-throw" || phase === "launched") && (
                    <p className="text-white/60 text-[14px] font-display font-black tracking-[0.3em] uppercase animate-pulse text-camera">
                      {t("game.throwNow")}
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    );
  }

  if (gameState === "processing") {
    return (
      <LoadingScreen status={processingStatus} progress={processingProgress} />
    );
  }

  // ---- Result screen ----
  if (resultData) {
    return (
      <main className="fixed inset-0 z-10 flex flex-col items-center bg-black overflow-y-auto safe-top safe-bottom">
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 w-full max-w-[400px]">
          {/* Personal best badge */}
          {resultData.isPersonalBest && (
            <div className="mb-6 px-4 py-1.5 border border-accent text-accent font-display text-[10px] tracking-widest uppercase text-glow animate-fade-in-up">
              {t("result.newRecord")}
            </div>
          )}

          {/* Height hero */}
          <div className="text-center mb-2 animate-fade-in-up delay-100">
            <p className="text-muted/40 text-[10px] tracking-[0.3em] uppercase mb-4">
              {t("result.height")}
            </p>
            <div className="flex items-baseline justify-center text-glow">
              <p className="font-display text-[clamp(4rem,20vw,6rem)] font-black text-accent leading-none hud-number animate-glow">
                {formatHeight(resultData.height)}
              </p>
              <span className="font-display text-[24px] text-accent-dark ml-1">m</span>
            </div>
          </div>

          {/* Airtime */}
          <p className="text-muted/40 text-[13px] tracking-[0.15em] mb-8 animate-fade-in-up delay-200">
            {t("result.airtime")}: <span className="text-white hud-number">{resultData.airtime.toFixed(2)}s</span>
          </p>

          {/* Video player */}
          {videoUrl && (
            <div className="w-full max-w-[280px] mb-8 relative overflow-hidden animate-fade-in-up delay-300">
              {resultData.ffmpegProcessed ? (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  autoPlay
                  muted
                  loop
                  className="w-full aspect-[9/16] object-cover"
                />
              ) : (
                <SlowMoPlayer
                  src={videoUrl}
                  slowStart={Math.max(0, resultData.peakOffset - 0.5)}
                  slowEnd={resultData.peakOffset + 0.5}
                  className="w-full aspect-[9/16] object-cover"
                />
              )}
            </div>
          )}

          {/* Action buttons */}
          {resultData.videoBlob && (
            <div className="grid grid-cols-2 gap-2 mb-6 w-full max-w-[280px] animate-fade-in-up delay-400">
              <button
                onClick={handleSaveVideo}
                className="py-4 bg-surface border border-border text-white font-display text-[10px] tracking-widest uppercase active:scale-[0.97] transition-all hover:border-muted"
              >
                {t("result.downloadVideo")}
              </button>
              <button
                onClick={handleShareVideo}
                className="py-4 bg-surface border border-border text-white font-display text-[10px] tracking-widest uppercase active:scale-[0.97] transition-all hover:border-muted"
              >
                {t("result.shareOn")}
              </button>
            </div>
          )}

          {/* Try Again CTA */}
          <button
            onClick={handleTryAgain}
            className="w-full max-w-[280px] py-5 bg-accent text-white font-display text-[16px] font-black tracking-[0.3em] uppercase shadow-[0_0_40px_rgba(255,45,45,0.3)] active:scale-[0.97] transition-transform duration-100 animate-fade-in-up delay-500 relative overflow-hidden group"
          >
            <span className="relative z-10">{t("result.tryAgain")}</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-active:translate-y-0 transition-transform duration-200 ease-out" />
          </button>
        </div>
      </main>
    );
  }

  return null;
}
