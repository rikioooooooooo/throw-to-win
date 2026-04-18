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

      // Draw each cylinder as a smooth filled taper shape (no segment joints)
      const TAPER_STEPS = 12;
      const WIDTH_NEAR = 2.5;
      const WIDTH_FAR = 0.1;
      const ALPHA_NEAR = 0.25;
      const ALPHA_FAR = 0.015;

      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const wx = ((col / (GRID_COLS - 1)) * 2 - 1) * OVERSHOOT;
          const wy = ((row / (GRID_ROWS - 1)) * 2 - 1) * OVERSHOOT;

          // Compute spine points along the cylinder
          const spineX: number[] = [];
          const spineY: number[] = [];
          for (let s = 0; s <= TAPER_STEPS; s++) {
            const t = s / TAPER_STEPS;
            const conv = 0.01 + (1 - t) * 0.99;
            const ancX = cx + (vanishX - cx) * t;
            const ancY = cy + (vanishY - cy) * t;
            spineX.push(ancX + wx * spreadX * conv);
            spineY.push(ancY + wy * spreadY * conv);
          }

          // Skip if fully off-screen
          const allOffL = spineX.every(x => x < -20);
          const allOffR = spineX.every(x => x > cw + 20);
          const allOffT = spineY.every(y => y < -20);
          const allOffB = spineY.every(y => y > ch + 20);
          if (allOffL || allOffR || allOffT || allOffB) continue;

          // Compute alpha (based on near-end position for text dimming)
          const nearX = spineX[0];
          const nearY = spineY[0];
          const distCX = Math.abs(nearX - cx) / cx;
          const distCY = Math.abs(nearY - cy) / cy;
          const centerP = 1 - Math.max(distCX, distCY);
          let alphaMul = 1;
          if (centerP > 0.4) {
            alphaMul = 0.3 + (1 - centerP) * 1.2;
          }

          // Build gradient along the line for smooth alpha fade
          const gradX0 = spineX[0];
          const gradY0 = spineY[0];
          const gradX1 = spineX[TAPER_STEPS];
          const gradY1 = spineY[TAPER_STEPS];
          const grad = ctx.createLinearGradient(gradX0, gradY0, gradX1, gradY1);
          const aN = Math.min(1, ALPHA_NEAR * alphaMul);
          const aF = Math.min(1, ALPHA_FAR * alphaMul);
          grad.addColorStop(0, `rgba(0, 250, 154, ${aN.toFixed(3)})`);
          grad.addColorStop(0.5, `rgba(0, 250, 154, ${(aN * 0.3 + aF * 0.7).toFixed(3)})`);
          grad.addColorStop(1, `rgba(0, 250, 154, ${aF.toFixed(3)})`);

          // Build the filled shape: left edge going forward, right edge going back
          // Perpendicular offset from spine for width
          ctx.beginPath();
          // Forward pass (left side of cylinder)
          for (let s = 0; s <= TAPER_STEPS; s++) {
            const t = s / TAPER_STEPS;
            const w = (WIDTH_NEAR + (WIDTH_FAR - WIDTH_NEAR) * t) / 2;
            // Perpendicular: use direction to next/prev point
            const si = Math.min(s, TAPER_STEPS - 1);
            const dxDir = spineX[si + 1] - spineX[si];
            const dyDir = spineY[si + 1] - spineY[si];
            const len = Math.sqrt(dxDir * dxDir + dyDir * dyDir) || 1;
            const px = -dyDir / len * w;
            const py = dxDir / len * w;
            if (s === 0) ctx.moveTo(spineX[s] + px, spineY[s] + py);
            else ctx.lineTo(spineX[s] + px, spineY[s] + py);
          }
          // Return pass (right side of cylinder)
          for (let s = TAPER_STEPS; s >= 0; s--) {
            const t = s / TAPER_STEPS;
            const w = (WIDTH_NEAR + (WIDTH_FAR - WIDTH_NEAR) * t) / 2;
            const si = Math.min(s, TAPER_STEPS - 1);
            const dxDir = spineX[si + 1] - spineX[si];
            const dyDir = spineY[si + 1] - spineY[si];
            const len = Math.sqrt(dxDir * dxDir + dyDir * dyDir) || 1;
            const px = -dyDir / len * w;
            const py = dxDir / len * w;
            ctx.lineTo(spineX[s] - px, spineY[s] - py);
          }
          ctx.closePath();
          ctx.fillStyle = grad;
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
