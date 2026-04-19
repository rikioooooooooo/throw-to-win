"use client";

import { useTranslations } from "next-intl";
import type { VideoProcessingStatus } from "@/lib/types";

type LoadingScreenProps = {
  status: VideoProcessingStatus;
  progress?: number;
};

function statusKey(status: VideoProcessingStatus): string {
  switch (status) {
    case "loading-ffmpeg":
      return "loadingFfmpeg";
    case "applying-slowmo":
      return "applyingSlowmo";
    case "encoding":
      return "encoding";
    case "done":
    case "processing":
    default:
      return "almostDone";
  }
}

export function LoadingScreen({ status, progress }: LoadingScreenProps) {
  const t = useTranslations("processing");

  const hasProgress =
    typeof progress === "number" && progress >= 0 && progress <= 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 gap-8 safe-top safe-bottom">
      {/* Dance animation */}
      <img src="/assets/anim/dance.webp" alt="" width={96} height={96} className="opacity-60" aria-hidden="true" />

      {/* Percentage below animation */}
      {hasProgress && (
        <span className="height-number text-[28px] text-foreground">
          {Math.round(progress!)}%
        </span>
      )}

      {/* Status text */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <h2 className="text-[20px] font-semibold uppercase tracking-widest text-foreground text-center">
          {t("heading")}
        </h2>
        <p className="text-muted text-[12px] tracking-[0.15em] uppercase text-center">
          {t(statusKey(status))}
        </p>

        {/* Progress bar */}
        <div className="w-full h-[2px] bg-border-subtle relative overflow-hidden">
          {hasProgress ? (
            <div
              className="absolute inset-y-0 left-0 bg-accent transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          ) : (
            <div
              className="absolute inset-y-0 left-0 w-1/3 bg-accent"
              style={{ animation: "subtle-pulse 1.5s ease-in-out infinite" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
