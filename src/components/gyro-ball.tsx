"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax poles with realistic depth cues:
 * - 3D-lit circular cross-sections (radial gradient highlight)
 * - Atmospheric perspective (near=green, far=blue-green haze)
 * - Staggered grid (odd rows offset for natural feel)
 * - Non-linear parallax response
 * - Perspective convergence + depth fog + vignette
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
const MAX_SHIFT = 90;
const LERP = 0.07;
const GYRO_TIMEOUT_MS = 2000;

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        // Stagger: odd rows shift half a column right
        const stagger = row % 2 === 1 ? 1 / (GRID_COLS - 1) : 0;
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 - 1 + stagger,
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

    // iOS requires requestPermission() from a user gesture for DeviceOrientationEvent.
    // Request on first tap anywhere on the page — one-shot, no UI needed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const needsPermission = typeof (DeviceOrientationEvent as any).requestPermission === "function";
    let permissionRequested = false;
    const requestOnTap = () => {
      if (permissionRequested) return;
      permissionRequested = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (DeviceOrientationEvent as any).requestPermission?.().catch(() => {});
      window.removeEventListener("touchstart", requestOnTap);
      window.removeEventListener("click", requestOnTap);
    };
    if (needsPermission && !hasGyroRef.current) {
      window.addEventListener("touchstart", requestOnTap, { once: true });
      window.addEventListener("click", requestOnTap, { once: true });
    }

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

    // Light direction (top-left, normalized)
    const lightX = -0.5;
    const lightY = -0.7;

    const draw = (now: number) => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      if (useFallback) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.35) * 0.25,
          y: Math.cos(t * 0.5) * 0.12,
        };
      }

      // Direct: no LERP smoothing — zero-lag response to tilt
      currentRef.current = { ...targetRef.current };

      // Non-linear response: gentle near center, stronger at edges
      const rawX = currentRef.current.x;
      const rawY = currentRef.current.y;
      const tiltX = Math.sign(rawX) * Math.pow(Math.abs(rawX), 0.7);
      const tiltY = Math.sign(rawY) * Math.pow(Math.abs(rawY), 0.7);

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

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        // Depth fog alpha
        const depthFog = Math.pow(1 - pole.z, 1.5);
        const alpha = 0.03 + depthFog * 0.40;

        // Atmospheric perspective: near=pure green, far=blue-shifted
        // Near: rgb(0, 250, 154) → Far: rgb(40, 180, 200)
        const nearness = 1 - pole.z;
        const r = Math.round(40 - nearness * 40);
        const g = Math.round(180 + nearness * 70);
        const b = Math.round(200 - nearness * 46);

        // 3D lighting: radial gradient to simulate lit cylinder top
        // Highlight offset from center based on light direction
        const hlOffX = lightX * radius * 0.35;
        const hlOffY = lightY * radius * 0.35;

        const grad = ctx.createRadialGradient(
          sx + hlOffX, sy + hlOffY, 0,
          sx, sy, radius,
        );
        // Highlight (brighter center)
        grad.addColorStop(0, `rgba(${r + 60}, ${g + 40}, ${b + 30}, ${Math.min(1, alpha * 1.8).toFixed(3)})`);
        // Mid
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`);
        // Edge shadow (darker)
        grad.addColorStop(1, `rgba(${Math.max(0, r - 20)}, ${Math.max(0, g - 40)}, ${b}, ${(alpha * 0.5).toFixed(3)})`);

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Vignette
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
      window.removeEventListener("touchstart", requestOnTap);
      window.removeEventListener("click", requestOnTap);
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
