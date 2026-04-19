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

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = hasProgress
    ? circumference - (circumference * progress!) / 100
    : circumference * 0.75;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 gap-8 safe-top safe-bottom">
      {/* Asset placeholder */}
      <div className="w-24 h-24 border border-dashed border-accent/20 rounded-lg flex items-center justify-center text-accent/30 text-[10px] text-center mb-4">
        （仮）<br/>ローディング
      </div>

      {/* Circular progress ring */}
      <div className="relative w-48 h-48 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          {/* Track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--color-border-subtle)"
            strokeWidth="2"
          />
          {/* Progress arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300 ease-out"
            style={
              !hasProgress
                ? { transformOrigin: "center", animation: "spin-slow 2s linear infinite" }
                : undefined
            }
          />
        </svg>

        {/* Percentage inside ring */}
        {hasProgress && (
          <span className="height-number text-[28px] text-foreground">
            {Math.round(progress!)}%
          </span>
        )}
      </div>

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
