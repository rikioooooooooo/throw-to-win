"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax: bars extending straight toward the viewer from depth.
 * Circular cross-sections with perspective convergence, depth fog, and vignette.
 */

type GyroBarsProps = {
  readonly className?: string;
};

const GRID_COLS = 18;
const GRID_ROWS = 30;
const VANISH_SHIFT = 100; // how far the vanishing point moves on full tilt
const LERP = 0.12;
const OVERSHOOT = 1.4; // grid extends 40% beyond screen edges
const GYRO_TIMEOUT_MS = 2000;

export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);
  // No poles array needed — lines are drawn directly from grid coords
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
      // Skip null values — iOS sometimes fires events with null,
      // which would snap the parallax to center (the "reset" bug)
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
      // Invalidate vignette cache
      vignetteSizeRef.current = { w: 0, h: 0 };
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();
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
      const spreadX = cw * 0.55;
      const spreadY = ch * 0.55;

      // Vanishing point shifts with tilt — this IS the parallax.
      // Dots don't translate; their convergence TARGET moves.
      const vanishX = cx + tiltX * VANISH_SHIFT;
      const vanishY = cy + tiltY * VANISH_SHIFT * 0.6;

      // Draw tapered lines from each grid position to vanishing point
      // Each line = one "cylinder" extending from near (edge) to far (center)
      const SEGMENTS = 20;
      const LINE_WIDTH_NEAR = 2.5;
      const LINE_WIDTH_FAR = 0.15;
      const ALPHA_NEAR = 0.25;
      const ALPHA_FAR = 0.02;

      // Unique grid positions (skip depth, draw one line per grid cell)
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const wx = ((col / (GRID_COLS - 1)) * 2 - 1) * OVERSHOOT;
          const wy = ((row / (GRID_ROWS - 1)) * 2 - 1) * OVERSHOOT;

          // Draw line as segments with tapering width and fading alpha
          for (let s = 0; s < SEGMENTS; s++) {
            const t0 = s / SEGMENTS;
            const t1 = (s + 1) / SEGMENTS;
            const z0 = t0; // 0=near, 1=far
            const z1 = t1;

            const conv0 = 0.01 + (1 - z0) * 0.99;
            const conv1 = 0.01 + (1 - z1) * 0.99;
            const anchor0X = cx + (vanishX - cx) * z0;
            const anchor0Y = cy + (vanishY - cy) * z0;
            const anchor1X = cx + (vanishX - cx) * z1;
            const anchor1Y = cy + (vanishY - cy) * z1;

            const x0 = anchor0X + wx * spreadX * conv0;
            const y0 = anchor0Y + wy * spreadY * conv0;
            const x1 = anchor1X + wx * spreadX * conv1;
            const y1 = anchor1Y + wy * spreadY * conv1;

            // Skip fully off-screen segments
            if (x0 < -10 && x1 < -10) continue;
            if (x0 > cw + 10 && x1 > cw + 10) continue;
            if (y0 < -10 && y1 < -10) continue;
            if (y0 > ch + 10 && y1 > ch + 10) continue;

            const midT = (t0 + t1) / 2;
            const lineW = LINE_WIDTH_NEAR + (LINE_WIDTH_FAR - LINE_WIDTH_NEAR) * midT;
            const depthFog = Math.pow(1 - midT, 1.5);
            let alpha = ALPHA_FAR + (ALPHA_NEAR - ALPHA_FAR) * depthFog;

            // Dim in text zone
            const midX = (x0 + x1) / 2;
            const midY = (y0 + y1) / 2;
            const distCX = Math.abs(midX - cx) / cx;
            const distCY = Math.abs(midY - cy) / cy;
            const centerP = 1 - Math.max(distCX, distCY);
            if (centerP > 0.4) {
              alpha *= 0.3 + (1 - centerP) * 1.2;
            }

            if (alpha < 0.003) continue;

            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.lineWidth = lineW;
            ctx.strokeStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
            ctx.lineCap = "round";
            ctx.stroke();
          }
        }
      }

      // Vignette: radial gradient darkening edges → "tunnel" depth feel
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
