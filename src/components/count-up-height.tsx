"use client";

import { useEffect, useRef } from "react";
import { formatHeight } from "@/lib/physics";

export type HeightSample = { readonly t: number; readonly h: number };

type CountUpHeightProps = {
  target: number;
  /** Recorded height samples from the actual throw — replayed on result screen */
  samples?: readonly HeightSample[];
  /** Fallback animation duration in ms when no samples available (default: 1400) */
  duration?: number;
  className?: string;
};

/**
 * Replays the actual throw's height progression on the result screen.
 * Uses recorded samples with time scaling so the replay takes ~1.2s.
 * Falls back to easeOutExpo when no samples are available.
 * Direct DOM updates (no React re-renders).
 */
export function CountUpHeight({
  target,
  samples,
  duration = 1400,
  className,
}: CountUpHeightProps) {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // --- Replay mode: use actual throw samples ---
    if (samples && samples.length >= 2) {
      // Trim trailing plateau (only replay the rising portion)
      let lastRising = 0;
      for (let i = 1; i < samples.length; i++) {
        if (samples[i].h > samples[i - 1].h) lastRising = i;
      }
      const trimmed = samples.slice(0, lastRising + 1);

      if (trimmed.length >= 2) {
        const t0 = trimmed[0].t;
        const totalTime = trimmed[trimmed.length - 1].t - t0;

        // Target ~1.2s replay — scale dynamically, never faster than real-time
        const TARGET_REPLAY_MS = 1200;
        const timeScale = Math.max(1, TARGET_REPLAY_MS / totalTime);
        const replayDuration = totalTime * timeScale;

        const start = performance.now();
        let rafId: number;

        const animate = () => {
          const elapsed = performance.now() - start;

          if (elapsed >= replayDuration) {
            el.textContent = formatHeight(target);
            return;
          }

          // Map elapsed → original time, then interpolate between samples
          const origTime = t0 + elapsed / timeScale;
          let h = 0;
          for (let i = 0; i < trimmed.length - 1; i++) {
            if (origTime <= trimmed[i + 1].t) {
              const span = trimmed[i + 1].t - trimmed[i].t;
              const frac = span > 0 ? (origTime - trimmed[i].t) / span : 0;
              h = trimmed[i].h + frac * (trimmed[i + 1].h - trimmed[i].h);
              break;
            }
          }
          // Past all samples → use last value
          if (origTime > trimmed[trimmed.length - 1].t) {
            h = trimmed[trimmed.length - 1].h;
          }

          el.textContent = formatHeight(h);
          rafId = requestAnimationFrame(animate);
        };

        rafId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafId);
      }
    }

    // --- Fallback: easeOutExpo ---
    const start = performance.now();
    let rafId: number;

    const animate = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      el.textContent = formatHeight(target * eased);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, samples, duration]);

  return (
    <span ref={spanRef} className={className}>
      {formatHeight(0)}
    </span>
  );
}
