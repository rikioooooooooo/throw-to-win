"use client";

import { useEffect, useRef } from "react";

export type HeightTier = "normal" | "personal-best" | "rank-update";

type HeightDisplayProps = {
  height: number;
  isAtPeak: boolean;
  tier?: HeightTier;
  tierColor?: string;
};

export function HeightDisplay({
  height,
  isAtPeak,
  tier = "normal",
  tierColor,
}: HeightDisplayProps) {
  const wasAtPeakRef = useRef(false);

  useEffect(() => {
    if (isAtPeak && !wasAtPeakRef.current) {
      wasAtPeakRef.current = true;

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        if (tier === "rank-update") {
          navigator.vibrate([100, 50, 100, 50, 200]);
        } else if (tier === "personal-best") {
          navigator.vibrate([50, 30, 100]);
        } else {
          navigator.vibrate(50);
        }
      }
    }
    if (!isAtPeak) {
      wasAtPeakRef.current = false;
    }
  }, [isAtPeak, tier]);

  const peakColor =
    tier === "rank-update"
      ? (tierColor ?? "var(--color-accent-gold)")
      : tier === "personal-best"
        ? "var(--color-accent)"
        : "var(--color-foreground)";

  const animationName =
    tier === "rank-update"
      ? "tier-3-peak"
      : tier === "personal-best"
        ? "tier-2-peak"
        : "tier-1-peak";

  const animationDuration =
    tier === "rank-update" ? "0.5s" : tier === "personal-best" ? "0.4s" : "0.3s";

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
      <div
        className="relative flex items-baseline gap-2"
        style={
          isAtPeak
            ? {
                animation: `${animationName} ${animationDuration} cubic-bezier(0.16, 1, 0.3, 1) forwards, landing-bounce 0.3s ease-out 0.1s both`,
              }
            : undefined
        }
      >
        <span
          className="height-number block text-center text-[clamp(6rem,30vw,14rem)]"
          style={{
            color: isAtPeak ? peakColor : "#ffffff",
            textShadow: isAtPeak
              ? undefined
              : "0 2px 12px rgba(0, 0, 0, 0.9), 0 4px 24px rgba(0, 0, 0, 0.7)",
            transition: "color 0.2s ease-out",
          }}
        >
          {height.toFixed(2)}
        </span>
        <span
          className="text-[clamp(1.5rem,6vw,3rem)] font-medium leading-none"
          style={{
            color: isAtPeak
              ? tier === "rank-update"
                ? (tierColor ? `${tierColor}80` : "rgba(255, 184, 0, 0.5)")
                : tier === "personal-best"
                  ? "rgba(255, 107, 53, 0.5)"
                  : "var(--color-muted)"
              : "var(--color-muted)",
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.9), 0 4px 24px rgba(0, 0, 0, 0.7)",
            transition: "color 0.2s ease-out",
          }}
        >
          m
        </span>
      </div>
    </div>
  );
}
