"use client";

import { useEffect, useRef } from "react";

/**
 * Simplest possible parallax: oversized image + position shift.
 * The 3D illusion comes from the image content (nested rectangles),
 * not from any code-side distortion. Zero artifacts.
 */

type GyroTunnelProps = {
  readonly className?: string;
};

const MAX_SHIFT = 20;
const SPRING_K = 0.05;
const SPRING_DAMPING = 0.80;
const GYRO_TIMEOUT_MS = 2000;
const SCALE = 1.08; // 8% oversized so edges don't show on shift

export function GyroTunnel({ className }: GyroTunnelProps) {
  const imgRef = useRef<HTMLDivElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      if (!calibratedRef.current) {
        calibratedRef.current = true;
        betaOffsetRef.current = e.beta;
      }
      const rawBetaDiff = e.beta - betaOffsetRef.current;
      if (Math.abs(rawBetaDiff) > 70) return;
      const betaDiff = Math.max(-50, Math.min(50, rawBetaDiff));
      const gamma = Math.max(-45, Math.min(45, e.gamma));
      targetRef.current = { x: gamma / 35, y: betaDiff / 35 };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let useFallback = false;
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) useFallback = true;
    }, GYRO_TIMEOUT_MS);

    const startTime = performance.now();
    const pos = posRef.current;
    const vel = velRef.current;

    const update = (now: number) => {
      if (useFallback && !hasGyroRef.current) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.3) * 0.12,
          y: Math.cos(t * 0.45) * 0.06,
        };
      }

      const tx = targetRef.current.x * MAX_SHIFT;
      const ty = targetRef.current.y * MAX_SHIFT;
      vel.x = vel.x * SPRING_DAMPING + (tx - pos.x) * SPRING_K;
      vel.y = vel.y * SPRING_DAMPING + (ty - pos.y) * SPRING_K;
      pos.x += vel.x;
      pos.y += vel.y;

      const el = imgRef.current;
      if (el) {
        el.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) scale(${SCALE})`;
      }

      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(gyroTimer);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  return (
    <div className={className} style={{ overflow: "hidden" }}>
      <div
        ref={imgRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/tunnel-bg.webp)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          transformOrigin: "center center",
          willChange: "transform",
        }}
      />
    </div>
  );
}
