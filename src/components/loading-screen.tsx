"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { VideoProcessingStatus } from "@/lib/types";

type LoadingScreenProps = {
  status: VideoProcessingStatus;
  progress?: number;
};

function useAnimatedDots(intervalMs = 500): string {
  const [count, setCount] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setCount(c => (c % 3) + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return ".".repeat(count);
}

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

function getEncouragingKey(progress: number): string {
  if (progress < 20) return "analyzing";
  if (progress < 45) return "calculating";
  if (progress < 70) return "processing";
  if (progress < 90) return "almostThere";
  return "finalizing";
}

/** Direct DOM manipulation for 60fps — no React re-renders */
function useSyntheticProgress(realProgress: number) {
  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const completedRef = useRef(false);
  // DOM refs for direct manipulation
  const arcRef = useRef<SVGCircleElement | null>(null);
  const dotRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLHeadingElement | null>(null);
  const circumferenceRef = useRef(0);
  const radiusRef = useRef(0);
  const sizeRef = useRef(0);

  useEffect(() => {
    targetRef.current = realProgress >= 100 ? 100 : Math.min(realProgress, 95);
  }, [realProgress]);

  useEffect(() => {
    const animate = (now: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = now;
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      let current = currentRef.current;
      const target = targetRef.current;

      if (target >= 100) {
        current += Math.max(30, (100 - current) * 5) * dt;
        if (current > 100) current = 100;
      } else {
        const speed = Math.max(0.5, (target - current) * 2);
        current += speed * dt;
        current = Math.min(current, 95);
      }
      currentRef.current = current;

      // Direct DOM updates — no setState, no re-render
      const circ = circumferenceRef.current;
      const r = radiusRef.current;
      const sz = sizeRef.current;

      if (arcRef.current && circ) {
        arcRef.current.style.strokeDashoffset = String(circ * (1 - current / 100));
      }
      if (dotRef.current && r && sz && current > 0 && current < 100) {
        const angle = (current / 100) * 2 * Math.PI - Math.PI / 2;
        dotRef.current.style.left = `${sz / 2 + r * Math.cos(angle) - 5}px`;
        dotRef.current.style.top = `${sz / 2 + r * Math.sin(angle) - 5}px`;
        dotRef.current.style.display = "block";
      } else if (dotRef.current) {
        dotRef.current.style.display = current >= 100 ? "none" : "block";
      }
      if (barRef.current) {
        barRef.current.style.width = `${current}%`;
      }

      // Completion burst
      if (current >= 100 && !completedRef.current) {
        completedRef.current = true;
        if (containerRef.current) {
          containerRef.current.style.animation = "completionBurst 0.8s ease-out";
        }
      }

      if (current < 100) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Restart RAF when real hits 100
  useEffect(() => {
    if (realProgress >= 100 && currentRef.current < 100) {
      targetRef.current = 100;
      lastTimeRef.current = 0;
      const rush = (now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = now;
        let c = currentRef.current;
        c += Math.max(30, (100 - c) * 5) * dt;
        if (c > 100) c = 100;
        currentRef.current = c;
        const circ = circumferenceRef.current;
        if (arcRef.current && circ) arcRef.current.style.strokeDashoffset = String(circ * (1 - c / 100));
        if (dotRef.current) dotRef.current.style.display = c >= 100 ? "none" : "block";
        if (barRef.current) barRef.current.style.width = `${c}%`;
        if (c >= 100 && !completedRef.current) {
          completedRef.current = true;
          if (containerRef.current) containerRef.current.style.animation = "completionBurst 0.8s ease-out";
        }
        if (c < 100) rafRef.current = requestAnimationFrame(rush);
      };
      rafRef.current = requestAnimationFrame(rush);
    }
  }, [realProgress]);

  return { arcRef, dotRef, barRef, containerRef, textRef, circumferenceRef, radiusRef, sizeRef, completedRef };
}

const completionBurstStyle = `
@keyframes completionBurst {
  0% { box-shadow: 0 0 0px rgba(0,250,154,0); transform: scale(1); }
  40% { box-shadow: 0 0 40px rgba(0,250,154,0.7), 0 0 80px rgba(0,250,154,0.3); transform: scale(1.05); }
  100% { box-shadow: 0 0 0px rgba(0,250,154,0); transform: scale(1); }
}
`;

export function LoadingScreen({ status, progress }: LoadingScreenProps) {
  const t = useTranslations("processing");
  const dots = useAnimatedDots();
  const refs = useSyntheticProgress(progress ?? 0);

  const hasProgress =
    typeof progress === "number" && progress >= 0 && progress <= 100;

  // SVG circle math (set once for the hook to use)
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  refs.circumferenceRef.current = circumference;
  refs.radiusRef.current = radius;
  refs.sizeRef.current = size;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <style dangerouslySetInnerHTML={{ __html: completionBurstStyle }} />

      {/* Ring + Dance container */}
      <div ref={refs.containerRef} className="relative" style={{
        width: size, height: size,
        borderRadius: "50%",
      }}>
        {/* Outer rotating halo */}
        <div
          className="absolute rounded-full"
          style={{
            inset: -12,
            border: "1px solid rgba(0, 250, 154, 0.12)",
            boxShadow:
              "0 0 20px rgba(0,250,154,0.1), 0 0 40px rgba(0,250,154,0.05)",
            animation: "spin-slow 8s linear infinite",
          }}
        />

        {/* Breathing scale on the ring */}
        <div style={{ animation: "subtle-pulse 2.5s ease-in-out infinite" }}>
          <svg
            width={size}
            height={size}
            className="block"
            style={{ transform: "rotate(-90deg)" }}
          >
            {/* Dashed track */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
              strokeDasharray="4 8"
            />
            {/* Progress arc */}
            <circle
              ref={refs.arcRef}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#00fa9a"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              style={{
                filter: "drop-shadow(0 0 8px rgba(0,250,154,0.5))",
              }}
            />
          </svg>

          {/* Leading edge glowing dot */}
          <div
            ref={refs.dotRef}
            className="absolute rounded-full"
            style={{
              width: 10,
              height: 10,
              left: 0,
              top: 0,
              background: "#fff",
              boxShadow: "0 0 10px 3px #00fa9a",
              display: "none",
            }}
          />
        </div>

        {/* Dance animation centered inside ring */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/assets/anim/dance.webp"
            alt=""
            width={96}
            height={96}
            aria-hidden="true"
            style={{}}

          />
        </div>
      </div>

      {/* Status text + progress bar */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs mt-10">
        <h2
          className="text-[16px] font-medium tracking-[0.15em] uppercase text-foreground/80 text-center"
          style={{ textShadow: "0 0 12px rgba(0,250,154,0.2)" }}
        >
          {t("heading")}{dots}
        </h2>
        <p className="text-foreground/30 text-[11px] tracking-[0.15em] uppercase text-center">
          {t(statusKey(status))}{dots}
        </p>

        {/* Thin progress bar */}
        <div className="w-full h-[2px] bg-white/5 relative overflow-hidden rounded-full">
          <div
            ref={refs.barRef}
            className="absolute inset-y-0 left-0 bg-accent rounded-full"
            style={{ width: "0%", boxShadow: "0 0 8px rgba(0,250,154,0.4)" }}
          />
        </div>
      </div>
    </div>
  );
}
