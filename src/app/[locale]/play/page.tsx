"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { useThrowDetection } from "@/hooks/use-throw-detection";
import { useCamera, type OverlayRenderer } from "@/hooks/use-camera";
import { hasValidConsent, addThrowRecord, loadData } from "@/lib/storage";
import { downloadBlob, shareNative, shareTo } from "@/lib/share";
import { processVideo, preloadFFmpeg } from "@/lib/video-processor";
import { formatHeight, GRAVITY } from "@/lib/physics";
import { generateFingerprint } from "@/lib/fingerprint";
import {
  requestChallenge,
  submitThrow,
  type ChallengeResponse,
  type VerifyResponse,
} from "@/lib/challenge";
import type { ThrowResult, VideoProcessingStatus } from "@/lib/types";
import { PermissionRequest } from "@/components/permission-request";
import { Countdown, type CountdownStep } from "@/components/countdown";
import { HeightDisplay, type HeightTier } from "@/components/height-display";
import { LoadingScreen } from "@/components/loading-screen";
import { ResultScreen } from "@/components/result-screen";
import Turnstile from "@/components/turnstile";

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
  const [isPersonalBest, setIsPersonalBest] = useState(false);
  const [rankingData, setRankingData] = useState<VerifyResponse | null>(null);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);

  const fingerprintRef = useRef<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const challengeDataRef = useRef<ChallengeResponse | null>(null);

  const {
    phase,
    result,
    realtimeHeight,
    getFreefallStartTime,
    getEstimatedV0,
    getSamples,
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
  /** Survives overlay state resets — holds the v0 trajectory peak for the result handler */
  const v0PeakRef = useRef(0);
  const overlayStateRef = useRef<{
    mode: "idle" | "countdown" | "height";
    countdownText: string;
    height: number;
    isAtPeak: boolean;
    /** Trajectory simulation: v0 from launch-phase integration */
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
  // Premium Extreme style: gradient scrim, tier-colored numbers, no thin frames

  const overlayRenderer = useCallback<OverlayRenderer>((ctx, w, h) => {
    const state = overlayStateRef.current;

    if (state.mode === "countdown") {
      const fontSize = Math.round(w * 0.35);
      ctx.fillStyle = "#ffffff";
      ctx.font = `400 ${fontSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(state.countdownText, w / 2, h / 2);
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      return;
    }

    if (state.mode === "height") {
      const CORRECTION_MS = 200;
      let displayHeight: number;
      let useAccentColor: boolean;

      if (state.correctionStartTime > 0) {
        if (state.correctionFrom > state.correctionTo) {
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
        const t = Math.min((performance.now() - state.freefallStartTime) / 1000, 4.0);
        const h_t = state.estimatedV0 * t - (GRAVITY * t * t) / 2;
        const clamped = Math.max(0, h_t);
        if (clamped > state.maxDisplayedHeight) {
          state.maxDisplayedHeight = clamped;
          v0PeakRef.current = clamped;
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

      // Measure text for centering
      ctx.font = `400 ${numSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const numWidth = ctx.measureText(heightStr).width;
      ctx.font = `500 ${unitSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      const mWidth = ctx.measureText("m").width;
      const gap = numSize * 0.1;
      const totalW = numWidth + gap + mWidth;
      const startX = (w - totalW) / 2;

      // ---- Height number ----
      ctx.fillStyle = useAccentColor ? "#ff2d2d" : "#ffffff";
      ctx.font = `400 ${numSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(heightStr, startX, y);

      // ---- Unit "m" ----
      ctx.fillStyle = useAccentColor
        ? "rgba(255, 45, 45, 0.5)"
        : "rgba(255, 255, 255, 0.35)";
      ctx.font = `500 ${unitSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillText("m", startX + numWidth + gap, y);

      // ---- Watermark ----
      const wmSize = Math.round(w * 0.022);
      ctx.shadowBlur = Math.round(w * 0.005);
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.font = `400 ${wmSize}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
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
  // When freefall starts: set trajectory params (v0 + startTime) for live simulation.
  // The renderer computes h(t) = v0t - gt^2/2 and tracks max (freezes at peak).
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
    // Active but pre-freefall (waiting-throw / launched): show "0.00m" in video overlay
    // so the recorded video shows the number sitting at 0 before it starts rising.
    if (gameState === "active") {
      overlayStateRef.current = {
        mode: "height",
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
      return;
    }
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

  // Preload ffmpeg + generate fingerprint + fetch Turnstile config
  useEffect(() => {
    preloadFFmpeg();
    generateFingerprint().then((fp) => {
      fingerprintRef.current = fp;
    });
    fetch("/api/config/")
      .then((r) => r.json())
      .then((data: { turnstileSiteKey?: string }) => {
        if (data.turnstileSiteKey) {
          setTurnstileSiteKey(data.turnstileSiteKey);
        }
      })
      .catch(() => {});
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
  // At landing: flash peak height in accent and FREEZE. The overlay sync useEffect
  // sets isAtPeak=true which stops live computation and locks the display.
  // Recording continues for 5 seconds to capture the catch moment.
  useEffect(() => {
    if (result && gameState === "active" && !finishingRef.current) {
      finishingRef.current = true;

      // Landing: if v0 trajectory was active, the tracked max IS the result.
      // No correction needed — just freeze at the displayed max.
      // Read from v0PeakRef (survives overlay state reset by the sync useEffect
      // that fires in the same render cycle when phase changes to "landed").
      const trackedMax = v0PeakRef.current;
      const finalHeight = trackedMax > 0 ? trackedMax : result.heightMeters;
      const displayResult: ThrowResult = trackedMax > 0
        ? { ...result, heightMeters: finalHeight }
        : result;

      // Compute personal best early — needed during 5s camera window before handleThrowComplete
      const currentData = loadData();
      setIsPersonalBest(finalHeight > currentData.stats.personalBest);

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

    // Request challenge nonce (non-blocking — if it fails, throw still works locally)
    const fp = fingerprintRef.current;
    const token = turnstileTokenRef.current;
    if (fp && token) {
      requestChallenge(fp, token)
        .then((data) => {
          challengeDataRef.current = data;
        })
        .catch(() => {
          challengeDataRef.current = null;
        });
    }

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

      // Capture sensor samples before resetDetection clears them
      const sensorSamples = getSamples();

      // Re-read personal best before addThrowRecord updates stats
      // (isPersonalBest state was set earlier for the camera-phase UI,
      // but the useCallback closure may hold a stale value)
      const pbBeforeAdd = loadData().stats.personalBest;
      const isPB = throwResult.heightMeters > pbBeforeAdd;

      addThrowRecord(
        throwResult.heightMeters,
        throwResult.airtimeSeconds,
      );

      // Submit to server (non-blocking — local result already saved)
      const challenge = challengeDataRef.current;
      const fp = fingerprintRef.current;
      if (challenge && fp) {
        submitThrow(
          challenge,
          { heightMeters: throwResult.heightMeters, airtimeSeconds: throwResult.airtimeSeconds },
          sensorSamples,
          fp,
        )
          .then((verifyResult) => {
            setRankingData(verifyResult);
          })
          .catch(() => {
            // Server submission failed — local result still shown
          });
        challengeDataRef.current = null;
      }

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
        isPersonalBest: isPB,
        videoBlob: processedBlob,
        peakOffset,
        ffmpegProcessed,
      });

      stopPreview();
      resetDetection();
      setGameState("done");
    },
    [stopRecording, stopPreview, resetDetection, getRecordingStartTime, getSamples],
  );

  const handleGoHome = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    stopPreview();
    router.push(`/${locale}`);
  }, [stopPreview, router, locale]);

  const handleTryAgain = useCallback(async () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
    if (finishTimeoutRef.current) {
      clearTimeout(finishTimeoutRef.current);
      finishTimeoutRef.current = null;
    }
    finishingRef.current = false;
    v0PeakRef.current = 0;
    challengeDataRef.current = null;
    turnstileTokenRef.current = null;
    setResultData(null);
    setVideoUrl(null);
    setPeakResult(null);
    setIsPersonalBest(false);
    setRankingData(null);
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

  // ---- Determine height tier for result ----
  const getResultTier = (): HeightTier => {
    if (!resultData) return "normal";
    if (resultData.isPersonalBest) return "personal-best";
    return "normal";
  };

  // ---- Render by game state ----

  // Turnstile callback
  const handleTurnstileToken = useCallback((token: string) => {
    turnstileTokenRef.current = token;
  }, []);

  if (gameState === "permissions") {
    return (
      <>
        <PermissionRequest onGranted={handlePermissionsGranted} />
        {turnstileSiteKey && (
          <Turnstile siteKey={turnstileSiteKey} onToken={handleTurnstileToken} />
        )}
      </>
    );
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

        {/* REC indicator */}
        {isRecording && (
          <div
            className="absolute left-4 z-20 flex items-center gap-2 px-3 py-1.5"
            style={{
              top: "max(1rem, env(safe-area-inset-top, 48px))",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "8px",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-accent animate-rec" />
            <span className="text-accent/60 text-[10px] label-text tracking-widest">
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
                    className={`min-w-[48px] h-9 px-3 text-[11px] font-medium tracking-wider uppercase transition-all duration-150 ${
                      activeLensId === lens.id
                        ? "bg-white/15 text-white backdrop-blur-md"
                        : "text-white/40 backdrop-blur-sm active:scale-90"
                    }`}
                    style={{
                      border: activeLensId === lens.id
                        ? "1px solid rgba(255, 255, 255, 0.3)"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "8px",
                    }}
                  >
                    {lens.shortLabel}
                  </button>
                ))}
              </div>
            )}

            {/* Bottom CTA with gradient fade */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-5 pb-8 safe-bottom bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              <p className="text-white/30 text-[11px] tracking-[0.1em] text-center mb-6 uppercase text-camera">
                {t("prepare.instruction")}
              </p>
              <button
                onClick={handleStartCountdown}
                className="w-full py-4 bg-accent text-white cta-text text-[16px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-100"
                style={{ borderRadius: "14px", height: "56px" }}
              >
                {t("prepare.startButton")}
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
              tier={
                peakResult
                  ? isPersonalBest
                    ? "personal-best"
                    : "normal"
                  : "normal"
              }
            />

            {/* Phase status badges */}
            {!peakResult && (
              <>
                {phase === "freefall" && (
                  <div
                    className="absolute top-4 right-4 safe-top z-30 px-3 py-1.5 text-accent label-text text-[10px] tracking-widest animate-pulse-red"
                    style={{
                      backgroundColor: "rgba(0, 0, 0, 0.5)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid var(--color-accent)",
                      borderRadius: "8px",
                    }}
                  >
                    {t("game.freefall")}
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-28 z-30 text-center safe-bottom">
                  {(phase === "waiting-throw" || phase === "launched") && (
                    <p className="text-white/60 text-[14px] font-medium tracking-[0.15em] uppercase animate-pulse text-camera">
                      {t("game.throwNow")}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Personal Best label */}
            {peakResult && isPersonalBest && (
              <div
                className="absolute z-30 flex justify-center"
                style={{
                  top: "60%",
                  left: 0,
                  right: 0,
                  animation: "spring-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
                }}
              >
                <span className="label-text text-[11px] tracking-[0.2em] text-accent text-camera">
                  PERSONAL BEST
                </span>
              </div>
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
      <ResultScreen
        resultData={resultData}
        rankingData={rankingData}
        videoUrl={videoUrl}
        resultTier={getResultTier()}
        onSaveVideo={handleSaveVideo}
        onShareVideo={handleShareVideo}
        onTryAgain={handleTryAgain}
        onGoHome={handleGoHome}
      />
    );
  }

  return null;
}
