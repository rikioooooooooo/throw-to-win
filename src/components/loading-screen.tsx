"use client";

import { useEffect, useRef, useState } from "react";
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

function getEncouragingKey(progress: number): string {
  if (progress < 20) return "analyzing";
  if (progress < 45) return "calculating";
  if (progress < 70) return "processing";
  if (progress < 90) return "almostThere";
  return "finalizing";
}

function useSyntheticProgress(realProgress: number): number {
  const [display, setDisplay] = useState(0);
  const currentRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

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
        // Rush to 100%
        current += Math.max(30, (100 - current) * 5) * dt;
        if (current > 100) current = 100;
      } else {
        // Normal: creep toward target, min 0.5%/sec
        const speed = Math.max(0.5, (target - current) * 2);
        current += speed * dt;
        current = Math.min(current, 95);
      }

      currentRef.current = current;
      setDisplay(current);

      if (current < 100) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Restart RAF when target changes to 100
  useEffect(() => {
    if (realProgress >= 100 && currentRef.current < 100) {
      targetRef.current = 100;
      lastTimeRef.current = 0;
      const animate = (now: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = now;
        const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
        lastTimeRef.current = now;
        let current = currentRef.current;
        current += Math.max(30, (100 - current) * 5) * dt;
        if (current > 100) current = 100;
        currentRef.current = current;
        setDisplay(current);
        if (current < 100) rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }
  }, [realProgress]);

  return display;
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

  const displayProgress = useSyntheticProgress(progress ?? 0);
  const completed = displayProgress >= 100;

  const hasProgress =
    typeof progress === "number" && progress >= 0 && progress <= 100;
  const pct = displayProgress;

  // SVG circle math
  const size = 200;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - pct / 100);

  // Leading edge dot position
  const angle = (pct / 100) * 2 * Math.PI - Math.PI / 2;
  const dotX = size / 2 + radius * Math.cos(angle);
  const dotY = size / 2 + radius * Math.sin(angle);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <style dangerouslySetInnerHTML={{ __html: completionBurstStyle }} />

      {/* Ring + Dance container */}
      <div className="relative" style={{
        width: size, height: size,
        borderRadius: "50%",
        ...(completed ? { animation: "completionBurst 0.8s ease-out" } : {}),
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
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#00fa9a"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                filter: "drop-shadow(0 0 8px rgba(0,250,154,0.5))",
              }}
            />
          </svg>

          {/* Leading edge glowing dot — hidden when completed (full circle) */}
          {pct > 0 && !completed && (
            <div
              className="absolute rounded-full"
              style={{
                width: 10,
                height: 10,
                left: dotX - 5,
                top: dotY - 5,
                background: "#fff",
                boxShadow: "0 0 10px 3px #00fa9a",
              }}
            />
          )}
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
          {hasProgress ? t(getEncouragingKey(pct)) : t("heading")}
        </h2>
        <p className="text-foreground/30 text-[11px] tracking-[0.15em] uppercase text-center">
          {t(statusKey(status))}
        </p>

        {/* Thin progress bar */}
        <div className="w-full h-[2px] bg-white/5 relative overflow-hidden rounded-full">
          {hasProgress ? (
            <div
              className="absolute inset-y-0 left-0 bg-accent rounded-full"
              style={{
                width: `${pct}%`,
                boxShadow: "0 0 8px rgba(0,250,154,0.4)",
              }}
            />
          ) : (
            <div
              className="absolute inset-y-0 left-0 w-1/3 bg-accent rounded-full"
              style={{ animation: "subtle-pulse 1.5s ease-in-out infinite" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
