"use client";

import { useEffect, useRef } from "react";

/**
 * Image-based parallax tunnel using CSS 3D perspective transform.
 * No image cutting — the entire image tilts as a 3D plane.
 * Near edges naturally shift more than center. Zero artifacts.
 */

type GyroTunnelProps = {
  readonly className?: string;
};

const MAX_ROTATE = 4;  // max degrees of rotation on full tilt
const SPRING_K = 0.06;
const SPRING_DAMPING = 0.78;
const GYRO_TIMEOUT_MS = 2000;

export function GyroTunnel({ className }: GyroTunnelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
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
          x: Math.sin(t * 0.3) * 0.15,
          y: Math.cos(t * 0.45) * 0.08,
        };
      }

      // Spring physics
      const tx = targetRef.current.x;
      const ty = targetRef.current.y;
      const fx = (tx - pos.x) * SPRING_K;
      const fy = (ty - pos.y) * SPRING_K;
      vel.x = vel.x * SPRING_DAMPING + fx;
      vel.y = vel.y * SPRING_DAMPING + fy;
      pos.x += vel.x;
      pos.y += vel.y;

      // Apply CSS 3D transform to the image
      const img = imgRef.current;
      if (img) {
        const rotY = pos.x * MAX_ROTATE;  // left-right tilt → rotate around Y axis
        const rotX = -pos.y * MAX_ROTATE; // up-down tilt → rotate around X axis
        img.style.transform =
          `perspective(600px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale(1.12)`;
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
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: "hidden", perspective: "600px" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src="/tunnel-bg.webp"
        alt=""
        aria-hidden="true"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transformOrigin: "center center",
          willChange: "transform",
        }}
      />
    </div>
  );
}
