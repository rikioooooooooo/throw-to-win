"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * 3D box illusion using ONLY dots.
 * Depth is conveyed through dot placement on virtual surfaces,
 * size/alpha gradients, color temperature shift, directional lighting,
 * and per-layer differential damping.
 */

type GyroBarsProps = {
  readonly className?: string;
};

type Dot = {
  readonly wx: number;
  readonly wy: number;
  readonly layer: number;
  readonly surface: "floor" | "left" | "right" | "back" | "ambient";
};

const TOTAL_DOTS = 1584;
const DEPTH_LAYERS = 8;
// Subtle positional parallax — just enough to feel depth, not enough to see outside box
const MAX_SHIFT = 15;
const GYRO_TIMEOUT_MS = 2000;
const LAYER_DAMPING_NEAR = 0.12;
const LAYER_DAMPING_FAR = 0.03;

const LAYER_RADIUS_NEAR = 4.5;
const LAYER_RADIUS_FAR = 0.6;
const LAYER_ALPHA_NEAR = 0.40;
const LAYER_ALPHA_FAR = 0.05;
const LAYER_COLOR_NEAR = [0, 250, 154] as const;
const LAYER_COLOR_FAR = [0, 140, 110] as const;

// Virtual light source — base position (upper center), shifts with tilt
const LIGHT_BASE_X = 0.0;
const LIGHT_BASE_Y = -0.6;
const LIGHT_TILT_FACTOR = 1.2; // how much tilt moves the light
const LIGHT_DECAY = 0.6;

// Surface distribution
const FLOOR_COUNT = Math.round(TOTAL_DOTS * 0.4);
const LEFT_WALL_COUNT = Math.round(TOTAL_DOTS * 0.2);
const RIGHT_WALL_COUNT = Math.round(TOTAL_DOTS * 0.2);
const BACK_WALL_COUNT = Math.round(TOTAL_DOTS * 0.1);
const AMBIENT_COUNT =
  TOTAL_DOTS - FLOOR_COUNT - LEFT_WALL_COUNT - RIGHT_WALL_COUNT - BACK_WALL_COUNT;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createDots(): readonly Dot[] {
  const dots: Dot[] = [];
  const rng = seededRandom(42);

  const assignLayer = (depth: number): number =>
    Math.min(DEPTH_LAYERS - 1, Math.max(0, Math.floor(depth * DEPTH_LAYERS)));

  // Floor dots — wy near 1.0, wx spread, depth varies
  for (let i = 0; i < FLOOR_COUNT; i++) {
    const wx = rng() * 2 - 1;
    const depth = rng();
    dots.push({
      wx,
      wy: 0.7 + rng() * 0.3,
      layer: assignLayer(depth),
      surface: "floor",
    });
  }

  // Left wall — wx near -1.0, wy spread, depth varies
  for (let i = 0; i < LEFT_WALL_COUNT; i++) {
    const depth = rng();
    dots.push({
      wx: -0.7 - rng() * 0.3,
      wy: rng() * 2 - 1,
      layer: assignLayer(depth),
      surface: "left",
    });
  }

  // Right wall — wx near 1.0, wy spread, depth varies
  for (let i = 0; i < RIGHT_WALL_COUNT; i++) {
    const depth = rng();
    dots.push({
      wx: 0.7 + rng() * 0.3,
      wy: rng() * 2 - 1,
      layer: assignLayer(depth),
      surface: "right",
    });
  }

  // Back wall — wx and wy spread, depth fixed at max
  for (let i = 0; i < BACK_WALL_COUNT; i++) {
    dots.push({
      wx: rng() * 2 - 1,
      wy: rng() * 2 - 1,
      layer: DEPTH_LAYERS - 1,
      surface: "back",
    });
  }

  // Ambient (free-floating)
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    dots.push({
      wx: rng() * 2 - 1,
      wy: rng() * 2 - 1,
      layer: Math.floor(rng() * DEPTH_LAYERS),
      surface: "ambient",
    });
  }

  // Sort far to near (layer 7 first, layer 0 last) for correct draw order
  return dots.sort((a, b) => b.layer - a.layer);
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
  const dotsRef = useRef<readonly Dot[]>(createDots());
  const vignetteRef = useRef<CanvasGradient | null>(null);
  const vignetteSizeRef = useRef({ w: 0, h: 0 });
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
    const dots = dotsRef.current;
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

      // Light source position shifts with tilt (smoothed via layer 3 damping)
      const lightX = LIGHT_BASE_X + smoothedX[3] * LIGHT_TILT_FACTOR;
      const lightY = LIGHT_BASE_Y + smoothedY[3] * LIGHT_TILT_FACTOR;

      // --- Dots (far to near, already sorted) ---
      for (const dot of dots) {
        const layerT = dot.layer / (DEPTH_LAYERS - 1);
        const z = (dot.layer + 1) / DEPTH_LAYERS;
        const convergence = 0.15 + (1 - z) * 0.85;

        // Subtle positional parallax (box feels slightly "peekable")
        const parallaxFactor = (1 - z) * MAX_SHIFT;
        const lx = smoothedX[dot.layer];
        const ly = smoothedY[dot.layer];
        const sx = cx + dot.wx * spreadX * convergence + lx * parallaxFactor;
        const sy = cy + dot.wy * spreadY * convergence + ly * parallaxFactor;

        const radius = lerp(LAYER_RADIUS_NEAR, LAYER_RADIUS_FAR, layerT);

        // Skip off-screen dots
        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        // Color temperature shift by depth
        const [cr, cg, cb] = lerpColor(LAYER_COLOR_NEAR, LAYER_COLOR_FAR, layerT);

        // Base alpha by depth
        const baseAlpha = lerp(LAYER_ALPHA_NEAR, LAYER_ALPHA_FAR, layerT);

        // Virtual light source modulation (light moves with tilt)
        const normX = (sx - cx) / cx;
        const normY = (sy - cy) / cy;
        const dx = normX - lightX;
        const dy = normY - lightY;
        const distSq = dx * dx + dy * dy;
        const lightFactor = Math.max(0.3, Math.min(1.0, 1.0 / (1.0 + LIGHT_DECAY * distSq)));

        // Edge brightness falloff
        const edgeFactor =
          1.0 -
          Math.max(Math.abs(sx - cx) / cx, Math.abs(sy - cy) / cy) * 0.3;

        // Surface-aware tilt brightness: walls facing the tilt direction get brighter
        let surfaceFactor = 1.0;
        const tX = smoothedX[3];
        const tY = smoothedY[3];
        if (dot.surface === "left") surfaceFactor = 1.0 + Math.max(0, -tX) * 1.2;
        else if (dot.surface === "right") surfaceFactor = 1.0 + Math.max(0, tX) * 1.2;
        else if (dot.surface === "floor") surfaceFactor = 1.0 + Math.max(0, tY) * 0.8;

        const alpha = baseAlpha * lightFactor * Math.max(0, edgeFactor) * surfaceFactor;

        if (alpha <= 0) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // --- Vignette ---
      if (vignetteSizeRef.current.w !== cw || vignetteSizeRef.current.h !== ch) {
        const diag = Math.sqrt(cx * cx + cy * cy);
        const grad = ctx.createRadialGradient(cx, cy, diag * 0.3, cx, cy, diag);
        grad.addColorStop(0, "rgba(5, 5, 8, 0)");
        grad.addColorStop(0.7, "rgba(5, 5, 8, 0.15)");
        grad.addColorStop(1, "rgba(5, 5, 8, 0.55)");
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
