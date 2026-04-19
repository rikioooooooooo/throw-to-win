"use client";

import { useEffect, useRef, useCallback } from "react";

type GyroBarsProps = {
  readonly className?: string;
  readonly onTilt?: (x: number, y: number) => void;
};

const GRID_COLS = 10;
const GRID_ROWS = 16;
const DEPTH_STEPS = 24;
const VANISH_SHIFT = 100;
const LERP_BASE = 0.16;
const OVERSHOOT = 1.4;
const GYRO_TIMEOUT_MS = 5000;
const W_NEAR = 3.0;
const W_FAR = 0.15;

const COLOR_BUCKETS = 12;
const ALPHA_BUCKETS = 6;
const COLOR_LUT: string[] = new Array(COLOR_BUCKETS * ALPHA_BUCKETS);
for (let ci = 0; ci < COLOR_BUCKETS; ci++) {
  const ef = ci / (COLOR_BUCKETS - 1);
  const r = Math.round(180 * ef);
  const g = Math.round(250 - 80 * ef);
  const b = Math.round(154 - 20 * ef);
  for (let ai = 0; ai < ALPHA_BUCKETS; ai++) {
    const a = (ai / (ALPHA_BUCKETS - 1)) * 0.18;
    COLOR_LUT[ci * ALPHA_BUCKETS + ai] = `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }
}

export function GyroBars({ className, onTilt }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const rafRef = useRef(0);
  const onTiltRef = useRef(onTilt);
  onTiltRef.current = onTilt;
  const lastFrameRef = useRef(0);
  const dimsRef = useRef({ w: 0, h: 0 });

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const initialOrientation = { gamma: 0, beta: 0, captured: false };
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      if (!initialOrientation.captured) {
        initialOrientation.gamma = e.gamma;
        initialOrientation.beta = e.beta;
        initialOrientation.captured = true;
      }
      targetRef.current = {
        x: Math.max(-1, Math.min(1, (e.gamma - initialOrientation.gamma) / 40)),
        y: Math.max(-1, Math.min(1, (e.beta - initialOrientation.beta) / 40)),
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dimsRef.current = { w, h };
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const spX = new Float64Array(DEPTH_STEPS + 1);
    const spY = new Float64Array(DEPTH_STEPS + 1);
    const nxR = new Float64Array(DEPTH_STEPS + 1);
    const nyR = new Float64Array(DEPTH_STEPS + 1);
    const nxL = new Float64Array(DEPTH_STEPS + 1);
    const nyL = new Float64Array(DEPTH_STEPS + 1);

    const startTime = performance.now();

    const draw = (now: number) => {
      const cw = dimsRef.current.w;
      const ch = dimsRef.current.h;
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      if (!hasGyroRef.current && (now - startTime) > GYRO_TIMEOUT_MS) {
        const t = (now - startTime) / 1000;
        targetRef.current = { x: Math.sin(t * 0.35) * 0.25, y: Math.cos(t * 0.5) * 0.12 };
      }

      const dt = Math.min((now - (lastFrameRef.current || now)) / 16.667, 3);
      lastFrameRef.current = now;
      const lerp = 1 - Math.pow(1 - LERP_BASE, dt);
      currentRef.current = {
        x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * lerp,
        y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * lerp,
      };

      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      const spreadX = cw * 0.55;
      const spreadY = ch * 0.55;
      const vanishX = cx + tiltX * VANISH_SHIFT;
      const vanishY = cy + tiltY * VANISH_SHIFT * 0.6;

      onTiltRef.current?.(tiltX, tiltY);

      const buckets = new Map<number, Path2D>();

      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const wx = ((col / (GRID_COLS - 1)) * 2 - 1) * OVERSHOOT;
          const wy = ((row / (GRID_ROWS - 1)) * 2 - 1) * OVERSHOOT;

          for (let s = 0; s <= DEPTH_STEPS; s++) {
            const t = s / DEPTH_STEPS;
            const conv = (1 - t) * (1 - t);
            spX[s] = (cx + (vanishX - cx) * t) + wx * spreadX * conv;
            spY[s] = (cy + (vanishY - cy) * t) + wy * spreadY * conv;
          }

          if (spX[0] < -20 && spX[DEPTH_STEPS] < -20) continue;
          if (spX[0] > cw + 20 && spX[DEPTH_STEPS] > cw + 20) continue;
          if (spY[0] < -20 && spY[DEPTH_STEPS] < -20) continue;
          if (spY[0] > ch + 20 && spY[DEPTH_STEPS] > ch + 20) continue;

          const distCX = Math.abs(spX[0] - cx) / cx;
          const distCY = Math.abs(spY[0] - cy) / cy;
          const centerP = 1 - Math.max(distCX, distCY);
          let alpha = 0.18;
          if (centerP > 0.4) alpha *= 0.3 + (1 - centerP) * 1.2;
          if (alpha < 0.003) continue;

          for (let s = 0; s <= DEPTH_STEPS; s++) {
            const t = s / DEPTH_STEPS;
            const w = (W_NEAR + (W_FAR - W_NEAR) * t) / 2;
            const si = Math.min(s, DEPTH_STEPS - 1);
            const dx = spX[si + 1] - spX[si];
            const dy = spY[si + 1] - spY[si];
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = (-dy / len) * w;
            const py = (dx / len) * w;
            nxR[s] = spX[s] + px;
            nyR[s] = spY[s] + py;
            nxL[s] = spX[s] - px;
            nyL[s] = spY[s] - py;
          }

          const edgeFade = Math.min(1, Math.max(Math.abs(wx), Math.abs(wy)));
          const ci = Math.min(COLOR_BUCKETS - 1, (edgeFade * (COLOR_BUCKETS - 1)) | 0);
          const ai = Math.min(ALPHA_BUCKETS - 1, ((alpha / 0.18) * (ALPHA_BUCKETS - 1)) | 0);
          const bucketKey = ci * ALPHA_BUCKETS + ai;

          let path = buckets.get(bucketKey);
          if (!path) { path = new Path2D(); buckets.set(bucketKey, path); }

          path.moveTo(nxR[0], nyR[0]);
          for (let s = 1; s <= DEPTH_STEPS; s++) path.lineTo(nxR[s], nyR[s]);
          for (let s = DEPTH_STEPS; s >= 0; s--) path.lineTo(nxL[s], nyL[s]);
          path.closePath();
        }
      }

      for (const [key, path] of buckets) {
        ctx.fillStyle = COLOR_LUT[key];
        ctx.fill(path);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={setCanvasRef} className={className} aria-hidden="true" />
      <div
        className={className}
        aria-hidden="true"
        style={{
          background: "radial-gradient(circle at center, rgba(5,10,8,0) 0%, rgba(5,10,8,0) 30%, rgba(5,10,8,0.2) 65%, rgba(5,10,8,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </>
  );
}
