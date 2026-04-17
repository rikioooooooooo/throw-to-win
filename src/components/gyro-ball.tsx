"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax: bars extending straight toward the viewer from depth.
 * Flat-fill circles for performance. Depth via size + convergence + fog + vignette.
 * Zero-lag gyro response. Fallback drift stops when permission is granted mid-session.
 */

type GyroBarsProps = {
  readonly className?: string;
};

type Pole = {
  readonly wx: number;
  readonly wy: number;
  readonly z: number;
};

const GRID_COLS = 11;
const GRID_ROWS = 18;
const DEPTH_LAYERS = 8;
const MAX_SHIFT = 80;
const GYRO_TIMEOUT_MS = 2000;

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 - 1,
          wy: (row / (GRID_ROWS - 1)) * 2 - 1,
          z,
        });
      }
    }
  }
  return poles.sort((a, b) => b.z - a.z);
}

export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);
  const polesRef = useRef<readonly Pole[]>(createPoles());
  const vignetteRef = useRef<CanvasGradient | null>(null);
  const vignetteSizeRef = useRef({ w: 0, h: 0 });

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      targetRef.current = {
        x: Math.max(-1, Math.min(1, e.gamma / 40)),
        y: Math.max(-1, Math.min(1, (e.beta - 50) / 40)),
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let useFallback = false;
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) useFallback = true;
    }, GYRO_TIMEOUT_MS);

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      vignetteSizeRef.current = { w: 0, h: 0 };
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();
    const poles = polesRef.current;

    const draw = (now: number) => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      // Fallback drift — stops when gyro permission is granted mid-session
      if (useFallback && !hasGyroRef.current) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.35) * 0.25,
          y: Math.cos(t * 0.5) * 0.12,
        };
      }

      // Zero-lag: direct copy, no LERP smoothing
      currentRef.current = { ...targetRef.current };

      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      const spreadX = cw * 0.6;
      const spreadY = ch * 0.6;

      for (const pole of poles) {
        const convergence = 0.15 + (1 - pole.z) * 0.85;
        const perspectiveScale = 1 / (0.2 + pole.z * 0.8);
        const parallaxFactor = (1 - pole.z) * MAX_SHIFT;

        const sx = cx + pole.wx * spreadX * convergence + tiltX * parallaxFactor;
        const sy = cy + pole.wy * spreadY * convergence + tiltY * parallaxFactor * 0.6;

        const radius = 4.0 * perspectiveScale;

        const depthFog = Math.pow(1 - pole.z, 1.5);
        const alpha = 0.03 + depthFog * 0.38;

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Vignette (cached — only 1 gradient create per resize)
      if (vignetteSizeRef.current.w !== cw || vignetteSizeRef.current.h !== ch) {
        const diag = Math.sqrt(cx * cx + cy * cy);
        const grad = ctx.createRadialGradient(cx, cy, diag * 0.3, cx, cy, diag);
        grad.addColorStop(0, "rgba(5, 5, 8, 0)");
        grad.addColorStop(0.7, "rgba(5, 5, 8, 0.15)");
        grad.addColorStop(1, "rgba(5, 5, 8, 0.5)");
        vignetteRef.current = grad;
        vignetteSizeRef.current = { w: cw, h: ch };
      }
      if (vignetteRef.current) {
        ctx.fillStyle = vignetteRef.current;
        ctx.fillRect(0, 0, cw, ch);
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
