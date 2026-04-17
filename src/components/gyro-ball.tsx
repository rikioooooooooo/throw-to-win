"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax: bars extending straight toward the viewer from depth.
 * You see their circular cross-sections. Tilting shifts perspective —
 * closer bars move more, distant bars less, creating a 3D window illusion.
 */

type GyroBarsProps = {
  readonly className?: string;
};

/** Pole in 3D space — position is fixed, only projection changes with tilt */
type Pole = {
  /** World-space grid position (normalized -1..1) */
  readonly wx: number;
  readonly wy: number;
  /** Depth: 0 = closest to screen, 1 = furthest */
  readonly z: number;
};

const GRID_COLS = 9;
const GRID_ROWS = 14;
const DEPTH_LAYERS = 5;
const MAX_SHIFT = 60; // px shift at full tilt for nearest layer
const LERP = 0.08;
const GYRO_TIMEOUT_MS = 2000;

/** Build a grid of poles across multiple depth layers */
function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS; // 0.2 .. 1.0
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 - 1,  // -1..1
          wy: (row / (GRID_ROWS - 1)) * 2 - 1,  // -1..1
          z,
        });
      }
    }
  }
  // Sort far-to-near so near poles draw on top
  return poles.sort((a, b) => b.z - a.z);
}

export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);
  const polesRef = useRef<readonly Pole[]>(createPoles());

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      hasGyroRef.current = true;
      const gamma = e.gamma ?? 0;
      const beta = e.beta ?? 0;
      targetRef.current = {
        x: Math.max(-1, Math.min(1, gamma / 40)),
        y: Math.max(-1, Math.min(1, (beta - 50) / 40)),
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let useFallback = false;
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) useFallback = true;
    }, GYRO_TIMEOUT_MS);

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
    const poles = polesRef.current;

    const draw = (now: number) => {
      const p = canvas.parentElement;
      if (!p) { rafRef.current = requestAnimationFrame(draw); return; }
      const { width: cw, height: ch } = p.getBoundingClientRect();
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      if (useFallback) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.35) * 0.25,
          y: Math.cos(t * 0.5) * 0.12,
        };
      }

      // Smooth interpolation
      currentRef.current = {
        x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * LERP,
        y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * LERP,
      };

      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      // Spread: how far the grid extends on screen
      const spreadX = cw * 0.55;
      const spreadY = ch * 0.55;

      for (const pole of poles) {
        // Perspective: closer (small z) → bigger shift, bigger circle
        // Far (z=1) → small shift, small circle
        const perspectiveScale = 1 / (0.3 + pole.z * 0.7);
        const parallaxFactor = (1 - pole.z) * MAX_SHIFT;

        // Screen position: grid position * spread + parallax shift from tilt
        const sx = cx + pole.wx * spreadX * (0.5 + pole.z * 0.5) + tiltX * parallaxFactor;
        const sy = cy + pole.wy * spreadY * (0.5 + pole.z * 0.5) + tiltY * parallaxFactor * 0.6;

        // Circle radius: closer = bigger
        const radius = 2.5 * perspectiveScale;

        // Opacity: closer = more visible
        const alpha = 0.04 + (1 - pole.z) * 0.10;

        // Skip if off-screen
        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 250, 154, ${alpha})`;
        ctx.fill();
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
