"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * 3D box illusion through the phone screen.
 * Trapezoidal wall gradients, 8 depth-layered dots with per-layer differential damping,
 * perspective floor grid, vignette, and optional kosukuma subliminal overlay.
 */

const ENABLE_KOSUKUMA = true;

type GyroBarsProps = {
  readonly className?: string;
};

type Pole = {
  readonly wx: number;
  readonly wy: number;
  readonly layer: number;
};

const GRID_COLS = 11;
const GRID_ROWS = 18;
const DEPTH_LAYERS = 8;
const MAX_SHIFT = 80;
const GYRO_TIMEOUT_MS = 2000;

// Layer 0 (nearest) → Layer 7 (farthest)
const LAYER_RADIUS_NEAR = 5;
const LAYER_RADIUS_FAR = 0.7;
const LAYER_ALPHA_NEAR = 0.42;
const LAYER_ALPHA_FAR = 0.05;
const LAYER_COLOR_NEAR = [0, 250, 154] as const;
const LAYER_COLOR_FAR = [4, 77, 48] as const;
const LAYER_DAMPING_NEAR = 0.12;
const LAYER_DAMPING_FAR = 0.03;

const INNER_RECT_RATIO = 0.6;
const WALL_SHIFT_FACTOR = 12;
const FLOOR_LINE_COUNT = 6;
const FLOOR_VP_Y_RATIO = 0.35;

const KOSUKUMA_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 648.37 444.18">
<path fill="#00fa9a" d="M292,57.07S411.85,1.16,490.27,32.83c37.48,15.14,144.72,78.99,147.82,187.62,3.1,108.63-66.7,158.21-66.7,158.21,0,0-69.33,58.49-149.28,57.7s-78.89-21.17-78.89-21.17l-21.41,2.37-33.97-56.73,40.88-94.62-36.73-209.14"/>
<polygon fill="#00fa9a" points="50.92 155.95 18.26 132.61 8.67 75.93 45.26 34.27 98.74 26.69 124.86 45.36 138.43 95.78 134.88 124.11 50.92 155.95"/>
<path fill="#000" d="M128.22,116.31s15.79-45.95-12.88-70.25c-36.36-30.82-106.79-.84-99.5,56.71,4.73,37.38,44.76,51.01,44.76,51.01l-9.05,8.89S14.79,158.44,1.49,107.22C-10.02,62.91,46.8-10.66,118.64,31.05c44.1,25.61,20.53,86.93,20.53,86.93l-10.95-1.67Z"/>
<path fill="#00fa9a" d="M197.75,348.5s-84.9,41.83-96.74,40.13c-11.83-1.7-75.66-6.8-77.77-44.74-2.12-37.94,25.15-47.16,25.15-47.16l37.9-1.18,26.45,9.21,27.6,4.25,57.41,39.49Z"/>
<path fill="#000" d="M92.35,304.68c-30.82-13.28-58.3,1.75-62.88,24.33-4.92,24.26,14.15,43.93,45.95,51.26,36.48,8.41,112.53-32,112.53-32l2.17,9.56s-66.22,36.38-112.13,31.78c-45.51-4.56-64.78-35.02-58.28-65.79,4.98-23.59,37.12-43.46,76.6-25.44,22.6,10.32,36.24,3.09,36.24,3.09,0,0-16.92,13.25-40.2,3.22Z"/>
<path fill="#000" d="M647.57,245.01c10.74-128.21-88.26-234.45-233.15-232.69-179.45,2.19-202.94,154.16-202.94,154.16,0,0,41.54-148.14,220.57-135.4,154.53,10.99,208.51,140.47,196.69,214.34-16.76,104.74-84.57,163.24-170.95,180.74-90.35,18.3-119.1-14.39-116.67-45.84,2.26-29.28,34.67-52.59,75.73-40.62,31.02,9.04,50.35-10.37,50.35-10.37,0,0-18.81,11.45-49.01,1.95-52.75-16.61-89.22,9.51-93.42,43.91-5.36,43.84,31.92,70.5,95.3,68.93,147.08-3.65,219.79-106.84,227.52-199.1Z"/>
<path fill="#00fa9a" d="M259.91,51.94s147.89,40.14,133.73,172.26c-9.19,85.74-70.56,120.87-70.56,120.87,0,0-60.94,30.34-99.27,35.22-38.33,4.88-106.64,12.1-117.18,5.01-10.55-7.09-24.67-47.95-24.67-47.95l-36.58-69.56-2.35-77.87,43.53-77.5,78.68-51.81,94.67-8.67Z"/>
<path fill="#000" d="M383.41,122.6c-51.63-76.57-168.5-101.56-252.1-57.94C35.05,114.89,2.07,212.8,55.57,306.33c9.54,16.68,20.04,40.74,25.84,57.89,3.83,11.33,21.31,35.88,70.51,33.31,21.2-1.11,45.86-6.24,73.2-12.93l-1.17-11.48c-27.48,5.62-55.45,9.52-75.78,11.99-37.36,4.54-55.66-23.94-59-33.82-5.06-14.96-16.91-42.27-19.23-46.44-45.63-81.89-24.28-183.24,77.21-228.53,75.08-33.51,180.11-11,222.81,57.25,60.05,95.96-17.82,187.09-6.71,187.75s87.29-99.19,20.17-198.73Z"/>
<polygon fill="#00fa9a" points="287.85 73.88 295.38 36.1 340.53 5.49 390.51 21.25 417.64 65.16 411.61 95.38 373.39 127.02 347.62 135.01 287.85 73.88"/>
<path fill="#000" d="M407.34,87.31c12.55-43.95-40.4-93.95-87.19-65.01-30.39,18.79-28.99,55.73-34.14,56.51-5.15.78-14.23-35.61,24.78-67.35,33.75-27.45,119.03-6.46,110.75,72.87-5.08,48.7-63.85,58.32-67,52.06-3.15-6.27,42.9-14.42,52.8-49.07Z"/>
<circle fill="#000" cx="171.34" cy="318.17" r="9.28"/>
<circle fill="#000" cx="121.78" cy="324.85" r="9.28"/>
<path fill="#000" d="M140.15,344.66c2.09-3.14,10.85-2.61,12.55-.29,1.84,2.51-2.22,6.56-5.87,6.68-2.95.1-8.65-3.44-6.68-6.39Z"/>
<path fill="#00fa9a" d="M326.93,417.64s-45.67,15.63-57.57,13.61c-11.9-2.03-100.27-8.23-99.9-62.05.27-38.37,46.02-44.98,46.02-44.98l38.29-.19,26.45,9.99,26.62-4.85,20.09,88.47Z"/>
<path fill="#000" d="M259.98,330.11c-38.02-17.57-72.79.29-79.24,28.31-6.93,30.1,8.82,57.03,55.66,65.45,45.98,8.27,104.43-20.67,104.43-20.67l2.4,12s-46.63,27.17-108.94,18.73c-54.28-7.35-75.1-38.89-63.64-80.48,8.91-32.33,46.71-50.64,92.64-32.22,28.78,11.54,54.66,1.16,55.03,3.64.38,2.49-29.62,18.51-58.34,5.24Z"/>
<polygon fill="#00fa9a" points="529.2 74.76 538.06 30.93 571.78 11.24 606.87 20.46 616.52 55.07 605.91 86.35 582.07 92.88 558.91 91.98 529.2 74.76"/>
<path fill="#000" d="M564.3,90.85c4.02-5.61,31.15,5.26,44.25-22.68,10.34-22.03,1.61-39.2-12.22-47-12.81-7.23-32.45-8.68-45.26,3.89-18.58,18.22-6.1,49.87-9.86,50.88-7.46,2-28.82-42.82,7.83-64.92,22.17-13.37,45.13-9.06,60.2,3.71,12.73,10.79,20.63,25.67,14.59,49.61-10.97,43.42-62.87,31.17-59.53,26.51Z"/>
<ellipse fill="#000" cx="560.9" cy="174.97" rx="18.7" ry="19.02"/>
</svg>`;

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let layer = 0; layer < DEPTH_LAYERS; layer++) {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 - 1,
          wy: (row / (GRID_ROWS - 1)) * 2 - 1,
          layer,
        });
      }
    }
  }
  // Sort far to near (layer 7 first, layer 0 last) for correct draw order
  return poles.sort((a, b) => b.layer - a.layer);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(
  near: readonly [number, number, number],
  far: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(lerp(near[0], far[0], t)),
    Math.round(lerp(near[1], far[1], t)),
    Math.round(lerp(near[2], far[2], t)),
  ];
}

export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const polesRef = useRef<readonly Pole[]>(createPoles());
  const vignetteRef = useRef<CanvasGradient | null>(null);
  const vignetteSizeRef = useRef({ w: 0, h: 0 });
  const kumaImgRef = useRef<HTMLImageElement | null>(null);
  // Per-layer smoothed tilt values
  const smoothedXRef = useRef(new Float32Array(DEPTH_LAYERS));
  const smoothedYRef = useRef(new Float32Array(DEPTH_LAYERS));

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Pre-render kosukuma SVG to image
    if (ENABLE_KOSUKUMA) {
      const blob = new Blob([KOSUKUMA_SVG], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        kumaImgRef.current = img;
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      if (!calibratedRef.current) {
        calibratedRef.current = true;
        betaOffsetRef.current = e.beta;
      }
      targetRef.current = {
        x: e.gamma / 35,
        y: (e.beta - betaOffsetRef.current) / 35,
      };
    };
    window.addEventListener("deviceorientation", handleOrientation);

    let useFallback = false;
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) useFallback = true;
    }, GYRO_TIMEOUT_MS);

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      vignetteSizeRef.current = { w: 0, h: 0 };
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();
    const poles = polesRef.current;
    const smoothedX = smoothedXRef.current;
    const smoothedY = smoothedYRef.current;

    const draw = (now: number) => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (cw === 0 || ch === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Fallback drift when no gyro
      if (useFallback && !hasGyroRef.current) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.35) * 0.25,
          y: Math.cos(t * 0.5) * 0.12,
        };
      }

      // Zero-lag: copy target directly (per-layer damping handles smoothing)
      currentRef.current = { x: targetRef.current.x, y: targetRef.current.y };
      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      // Update per-layer smoothed values
      for (let i = 0; i < DEPTH_LAYERS; i++) {
        const t = i / (DEPTH_LAYERS - 1);
        const damping = lerp(LAYER_DAMPING_NEAR, LAYER_DAMPING_FAR, t);
        smoothedX[i] += (tiltX - smoothedX[i]) * damping;
        smoothedY[i] += (tiltY - smoothedY[i]) * damping;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      const spreadX = cw * 0.6;
      const spreadY = ch * 0.6;

      // Inner rect for wall gradients (shifts with tilt)
      const innerW = cw * INNER_RECT_RATIO;
      const innerH = ch * INNER_RECT_RATIO;
      const innerCx = cx + tiltX * WALL_SHIFT_FACTOR;
      const innerCy = cy + tiltY * WALL_SHIFT_FACTOR;
      const innerLeft = innerCx - innerW / 2;
      const innerRight = innerCx + innerW / 2;
      const innerTop = innerCy - innerH / 2;
      const innerBottom = innerCy + innerH / 2;

      // --- 1. Floor grid (behind everything) ---
      const vpX = innerCx;
      const vpY = ch * FLOOR_VP_Y_RATIO + tiltY * WALL_SHIFT_FACTOR;
      ctx.strokeStyle = "rgba(0, 250, 154, 0.025)";
      ctx.lineWidth = 0.5;
      const floorBottom = ch;
      const floorSpan = floorBottom - vpY;
      for (let i = 0; i < FLOOR_LINE_COUNT; i++) {
        // Perspective foreshortening: lines closer to VP are spaced tighter
        const frac = (i + 1) / (FLOOR_LINE_COUNT + 1);
        const perspY = vpY + floorSpan * (frac * frac);
        // Horizontal lines that widen with distance from VP
        const widthFrac = (perspY - vpY) / floorSpan;
        const halfW = cw * 0.5 * (0.2 + widthFrac * 0.8);
        ctx.beginPath();
        ctx.moveTo(vpX - halfW, perspY);
        ctx.lineTo(vpX + halfW, perspY);
        ctx.stroke();
      }

      // --- 2. Trapezoidal wall gradients ---
      // Top wall
      drawTrapezoidWall(ctx, cw, ch,
        0, 0, cw, 0,              // outer edge (top of screen)
        innerLeft, innerTop, innerRight, innerTop,  // inner edge
      );
      // Bottom wall
      drawTrapezoidWall(ctx, cw, ch,
        0, ch, cw, ch,
        innerLeft, innerBottom, innerRight, innerBottom,
      );
      // Left wall
      drawTrapezoidWall(ctx, cw, ch,
        0, 0, 0, ch,
        innerLeft, innerTop, innerLeft, innerBottom,
      );
      // Right wall
      drawTrapezoidWall(ctx, cw, ch,
        cw, 0, cw, ch,
        innerRight, innerTop, innerRight, innerBottom,
      );

      // --- 3. Dots (far to near, already sorted) ---
      for (const pole of poles) {
        const layerT = pole.layer / (DEPTH_LAYERS - 1);
        const z = (pole.layer + 1) / DEPTH_LAYERS;
        const convergence = 0.15 + (1 - z) * 0.85;
        const parallaxFactor = (1 - z) * MAX_SHIFT;

        const lx = smoothedX[pole.layer];
        const ly = smoothedY[pole.layer];

        const sx = cx + pole.wx * spreadX * convergence + lx * parallaxFactor;
        const sy = cy + pole.wy * spreadY * convergence + ly * parallaxFactor;

        const radius = lerp(LAYER_RADIUS_NEAR, LAYER_RADIUS_FAR, layerT);
        const alpha = lerp(LAYER_ALPHA_NEAR, LAYER_ALPHA_FAR, layerT);
        const [cr, cg, cb] = lerpColor(LAYER_COLOR_NEAR, LAYER_COLOR_FAR, layerT);

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // --- 4. Vignette ---
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

      // --- 5. Kosukuma subliminal overlay ---
      if (ENABLE_KOSUKUMA) {
        const kumaImg = kumaImgRef.current;
        if (kumaImg) {
          const kumaAspect = 648.37 / 444.18;
          const kumaW = cw * 0.55;
          const kumaH = kumaW / kumaAspect;
          // Mid-depth parallax (layer 4 speed)
          const kumaX = cx - kumaW / 2 + smoothedX[4] * MAX_SHIFT * 0.3;
          const kumaY = cy - kumaH / 2 + smoothedY[4] * MAX_SHIFT * 0.3;
          ctx.save();
          ctx.globalAlpha = 0.06;
          ctx.drawImage(kumaImg, kumaX, kumaY, kumaW, kumaH);
          ctx.restore();
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

/**
 * Draw a single trapezoidal wall with quadratic gradient falloff.
 * Outer edge = screen edge (opaque end), inner edge = inner rect edge (transparent end).
 * Uses scanline fill for the trapezoid shape with per-pixel alpha.
 */
function drawTrapezoidWall(
  ctx: CanvasRenderingContext2D,
  _cw: number,
  _ch: number,
  // Outer edge line (two points on screen edge)
  ox1: number, oy1: number, ox2: number, oy2: number,
  // Inner edge line (two points on inner rect edge)
  ix1: number, iy1: number, ix2: number, iy2: number,
) {
  ctx.beginPath();
  ctx.moveTo(ox1, oy1);
  ctx.lineTo(ox2, oy2);
  ctx.lineTo(ix2, iy2);
  ctx.lineTo(ix1, iy1);
  ctx.closePath();

  // Gradient direction: from outer midpoint to inner midpoint
  const omx = (ox1 + ox2) / 2;
  const omy = (oy1 + oy2) / 2;
  const imx = (ix1 + ix2) / 2;
  const imy = (iy1 + iy2) / 2;

  const grad = ctx.createLinearGradient(omx, omy, imx, imy);
  // Quadratic falloff: add multiple stops to simulate t*t curve
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const alpha = 0.06 * (1 - t * t);
    grad.addColorStop(t, `rgba(0, 250, 154, ${alpha.toFixed(4)})`);
  }
  ctx.fillStyle = grad;
  ctx.fill();
}
