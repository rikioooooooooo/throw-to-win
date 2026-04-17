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

const GRID_COLS = 15;
const GRID_ROWS = 26;
const DEPTH_LAYERS = 8;
const MAX_SHIFT = 150;
const GYRO_TIMEOUT_MS = 2000;
/** Grid extends beyond -1..1 so poles are always available off-screen */
const GRID_RANGE = 1.8;

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 * GRID_RANGE - GRID_RANGE,
          wy: (row / (GRID_ROWS - 1)) * 2 * GRID_RANGE - GRID_RANGE,
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
      // No clamping — let extreme tilts produce extreme parallax
      targetRef.current = {
        x: e.gamma / 35,
        y: (e.beta - 50) / 35,
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
        const sy = cy + pole.wy * spreadY * convergence + tiltY * parallaxFactor;

        const radius = 4.0 * perspectiveScale;

        const depthFog = Math.pow(1 - pole.z, 1.5);
        const alpha = 0.03 + depthFog * 0.38;

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // --- Box walls: appear when tilting, opposite side becomes visible ---
      // Tilt right (tiltX>0) → left wall visible, etc.
      const WALL_MAX = 80; // max wall depth in px at extreme tilt
      const WALL_COLOR = "0, 250, 154";
      const WALL_LINES = 6; // horizontal grid lines per wall

      // Left wall (visible when tiltX > 0)
      if (tiltX > 0.05) {
        const w = Math.min(WALL_MAX, tiltX * WALL_MAX);
        const wallAlpha = Math.min(0.12, tiltX * 0.1);
        const grad = ctx.createLinearGradient(0, 0, w, 0);
        grad.addColorStop(0, `rgba(${WALL_COLOR}, ${wallAlpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${WALL_COLOR}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, ch);
        // Grid lines on wall
        ctx.strokeStyle = `rgba(${WALL_COLOR}, ${(wallAlpha * 0.6).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= WALL_LINES; i++) {
          const ly = (i / (WALL_LINES + 1)) * ch;
          ctx.beginPath();
          ctx.moveTo(0, ly);
          ctx.lineTo(w * 0.8, ly);
          ctx.stroke();
        }
      }

      // Right wall (visible when tiltX < -0.05)
      if (tiltX < -0.05) {
        const w = Math.min(WALL_MAX, -tiltX * WALL_MAX);
        const wallAlpha = Math.min(0.12, -tiltX * 0.1);
        const grad = ctx.createLinearGradient(cw, 0, cw - w, 0);
        grad.addColorStop(0, `rgba(${WALL_COLOR}, ${wallAlpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${WALL_COLOR}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(cw - w, 0, w, ch);
        ctx.strokeStyle = `rgba(${WALL_COLOR}, ${(wallAlpha * 0.6).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= WALL_LINES; i++) {
          const ly = (i / (WALL_LINES + 1)) * ch;
          ctx.beginPath();
          ctx.moveTo(cw, ly);
          ctx.lineTo(cw - w * 0.8, ly);
          ctx.stroke();
        }
      }

      // Top wall (visible when tiltY > 0.05)
      if (tiltY > 0.05) {
        const h = Math.min(WALL_MAX, tiltY * WALL_MAX);
        const wallAlpha = Math.min(0.12, tiltY * 0.1);
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, `rgba(${WALL_COLOR}, ${wallAlpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${WALL_COLOR}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, cw, h);
        ctx.strokeStyle = `rgba(${WALL_COLOR}, ${(wallAlpha * 0.6).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= WALL_LINES; i++) {
          const lx = (i / (WALL_LINES + 1)) * cw;
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, h * 0.8);
          ctx.stroke();
        }
      }

      // Bottom wall (visible when tiltY < -0.05)
      if (tiltY < -0.05) {
        const h = Math.min(WALL_MAX, -tiltY * WALL_MAX);
        const wallAlpha = Math.min(0.12, -tiltY * 0.1);
        const grad = ctx.createLinearGradient(0, ch, 0, ch - h);
        grad.addColorStop(0, `rgba(${WALL_COLOR}, ${wallAlpha.toFixed(3)})`);
        grad.addColorStop(1, `rgba(${WALL_COLOR}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, ch - h, cw, h);
        ctx.strokeStyle = `rgba(${WALL_COLOR}, ${(wallAlpha * 0.6).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        for (let i = 1; i <= WALL_LINES; i++) {
          const lx = (i / (WALL_LINES + 1)) * cw;
          ctx.beginPath();
          ctx.moveTo(lx, ch);
          ctx.lineTo(lx, ch - h * 0.8);
          ctx.stroke();
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
