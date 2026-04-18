"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax: bars extending straight toward the viewer from depth.
 * Circular cross-sections with perspective convergence, depth fog, and vignette.
 */

type GyroBarsProps = {
  readonly className?: string;
  readonly onTilt?: (x: number, y: number) => void;
};

const GRID_COLS = 14;
const GRID_ROWS = 22;
const DEPTH_STEPS = 40; // more steps = smoother convergence to infinity
const VANISH_SHIFT = 100; // how far the vanishing point moves on full tilt
const LERP = 0.12;
const OVERSHOOT = 1.4; // grid extends 40% beyond screen edges
const GYRO_TIMEOUT_MS = 2000;

export function GyroBars({ className, onTilt }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);
  const onTiltRef = useRef(onTilt);
  onTiltRef.current = onTilt; // always latest callback
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

      // Notify parent of tilt for CSS 3D transform
      onTiltRef.current?.(tiltX, tiltY);

      // Draw tapered cylinders — NO gradients (perf), single fill per shape
      const STEPS = DEPTH_STEPS;
      const W_NEAR = 2.5;
      const W_FAR = 0.1;

      const spX = new Array<number>(DEPTH_STEPS + 1);
      const spY = new Array<number>(DEPTH_STEPS + 1);

      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const wx = ((col / (GRID_COLS - 1)) * 2 - 1) * OVERSHOOT;
          const wy = ((row / (GRID_ROWS - 1)) * 2 - 1) * OVERSHOOT;

          // Spine points — quadratic convergence (accelerates toward vanishing point)
          for (let s = 0; s <= STEPS; s++) {
            const t = s / STEPS;
            const conv = (1 - t) * (1 - t); // t=0→1.0, t=1→0.0 (true point)
            spX[s] = (cx + (vanishX - cx) * t) + wx * spreadX * conv;
            spY[s] = (cy + (vanishY - cy) * t) + wy * spreadY * conv;
          }

          // Quick off-screen check (near + far endpoints)
          if (spX[0] < -20 && spX[STEPS] < -20) continue;
          if (spX[0] > cw + 20 && spX[STEPS] > cw + 20) continue;
          if (spY[0] < -20 && spY[STEPS] < -20) continue;
          if (spY[0] > ch + 20 && spY[STEPS] > ch + 20) continue;

          // Alpha based on position (text zone dimming)
          const distCX = Math.abs(spX[0] - cx) / cx;
          const distCY = Math.abs(spY[0] - cy) / cy;
          const centerP = 1 - Math.max(distCX, distCY);
          let alpha = 0.18;
          if (centerP > 0.4) alpha *= 0.3 + (1 - centerP) * 1.2;
          if (alpha < 0.003) continue;

          // Build filled taper shape
          ctx.beginPath();
          for (let s = 0; s <= STEPS; s++) {
            const t = s / STEPS;
            const w = (W_NEAR + (W_FAR - W_NEAR) * t) / 2;
            const si = Math.min(s, STEPS - 1);
            const dx = spX[si + 1] - spX[si];
            const dy = spY[si + 1] - spY[si];
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = -dy / len * w;
            const py = dx / len * w;
            if (s === 0) ctx.moveTo(spX[s] + px, spY[s] + py);
            else ctx.lineTo(spX[s] + px, spY[s] + py);
          }
          for (let s = STEPS; s >= 0; s--) {
            const t = s / STEPS;
            const w = (W_NEAR + (W_FAR - W_NEAR) * t) / 2;
            const si = Math.min(s, STEPS - 1);
            const dx = spX[si + 1] - spX[si];
            const dy = spY[si + 1] - spY[si];
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = -dy / len * w;
            const py = dx / len * w;
            ctx.lineTo(spX[s] - px, spY[s] - py);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
          ctx.fill();
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
