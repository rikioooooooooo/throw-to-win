"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope-driven parallax vertical bars.
 * Creates the illusion that the phone screen is a window into a 3D space
 * with evenly-spaced vertical poles standing behind it.
 * Tilting the phone shifts perspective — closer poles move more, far poles less.
 */

type GyroBarsProps = {
  readonly className?: string;
};

// Depth layers — each has poles at a different Z-distance from the "window"
const LAYERS = [
  { z: 0.15, opacity: 0.04, width: 6 },
  { z: 0.3,  opacity: 0.06, width: 4.5 },
  { z: 0.5,  opacity: 0.08, width: 3 },
  { z: 0.75, opacity: 0.10, width: 2 },
  { z: 1.0,  opacity: 0.12, width: 1.5 },
] as const;

/** How many poles per layer across the visible width */
const POLES_PER_SCREEN = 12;
/** Extra poles rendered off-screen on each side so tilting doesn't reveal gaps */
const OVERSHOOT = 8;
/** Max parallax shift in px at full tilt */
const MAX_SHIFT = 120;
const GYRO_TIMEOUT_MS = 2000;
/** Smoothing factor — lower = smoother but laggier (0-1) */
const LERP = 0.08;

export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // --- Device orientation ---
    const handleOrientation = (e: DeviceOrientationEvent) => {
      hasGyroRef.current = true;
      const gamma = e.gamma ?? 0; // left-right: -90..90
      const beta = e.beta ?? 0;   // front-back: -180..180
      // Normalize to -1..1, clamped
      targetRef.current = {
        x: Math.max(-1, Math.min(1, gamma / 45)),
        y: Math.max(-1, Math.min(1, (beta - 45) / 45)),
        // beta resting is ~45° when phone held naturally, so subtract 45
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let useFallback = false;
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) useFallback = true;
    }, GYRO_TIMEOUT_MS);

    // --- Canvas setup ---
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const p = canvas.parentElement;
      if (!p) return;
      const r = p.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();

    const draw = (now: number) => {
      const p = canvas.parentElement;
      if (!p) { rafRef.current = requestAnimationFrame(draw); return; }
      const { width: cw, height: ch } = p.getBoundingClientRect();
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      // Fallback: gentle drift
      if (useFallback) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.4) * 0.3,
          y: Math.cos(t * 0.6) * 0.15,
        };
      }

      // Smooth interpolation
      currentRef.current = {
        x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * LERP,
        y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * LERP,
      };

      const shiftX = currentRef.current.x * MAX_SHIFT;
      const shiftY = currentRef.current.y * MAX_SHIFT * 0.3; // vertical shift is subtler

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      // Draw each depth layer (far to near)
      for (const layer of LAYERS) {
        const parallaxX = shiftX * layer.z;
        const parallaxY = shiftY * layer.z;

        // Pole spacing based on screen width
        const spacing = cw / POLES_PER_SCREEN;
        const totalPoles = POLES_PER_SCREEN + OVERSHOOT * 2;

        // Base offset so poles are centered, plus parallax
        const baseX = -OVERSHOOT * spacing + parallaxX;

        ctx.fillStyle = `rgba(0, 250, 154, ${layer.opacity})`;

        for (let i = 0; i < totalPoles; i++) {
          const x = baseX + i * spacing + spacing / 2;

          // Slight vertical perspective: poles closer to edge are a bit shorter
          const distFromCenter = Math.abs(x - cw / 2) / (cw / 2);
          const heightScale = 1 - distFromCenter * 0.08;
          const poleH = ch * heightScale;
          const poleY = (ch - poleH) / 2 + parallaxY;

          ctx.fillRect(
            Math.round(x - layer.width / 2),
            Math.round(poleY),
            layer.width,
            Math.round(poleH),
          );
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(gyroTimer);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={setCanvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
