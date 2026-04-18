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

const TOTAL_DOTS = 2500;
const DEPTH_LAYERS = 14;
const MAX_SHIFT = 45;
const OVERSHOOT = 1.3;
const GYRO_TIMEOUT_MS = 2000;
const SPRING_K = 0.08;
const SPRING_DAMPING = 0.75;

// Dramatic depth: near dots are huge and bright, far dots are invisible specks
const LAYER_RADIUS_NEAR = 8.0;
const LAYER_RADIUS_FAR = 0.3;
const LAYER_ALPHA_NEAR = 0.55;
const LAYER_ALPHA_FAR = 0.03;
const LAYER_COLOR_NEAR = [0, 255, 160] as const;  // bright mint
const LAYER_COLOR_FAR = [0, 80, 55] as const;     // very dark teal
// Glow: near dots get canvas shadow blur for bloom effect
const GLOW_LAYERS = 4; // layers 0-3 get glow
const GLOW_RADIUS_MAX = 12; // blur px for layer 0

const LIGHT_BASE_X = 0.0;
const LIGHT_BASE_Y = -0.6;
const LIGHT_TILT_FACTOR = 1.2;
const LIGHT_DECAY = 0.5;

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

  // All dots placed in OVERSHOOT range (1.3x screen) so edges never visible on tilt
  const R = OVERSHOOT;

  // Floor dots — wy near bottom, wx spread
  for (let i = 0; i < FLOOR_COUNT; i++) {
    dots.push({
      wx: (rng() * 2 - 1) * R,
      wy: (0.7 + rng() * 0.3) * R,
      layer: assignLayer(rng()),
      surface: "floor",
    });
  }

  // Left wall — wx near left
  for (let i = 0; i < LEFT_WALL_COUNT; i++) {
    dots.push({
      wx: (-0.7 - rng() * 0.3) * R,
      wy: (rng() * 2 - 1) * R,
      layer: assignLayer(rng()),
      surface: "left",
    });
  }

  // Right wall — wx near right
  for (let i = 0; i < RIGHT_WALL_COUNT; i++) {
    dots.push({
      wx: (0.7 + rng() * 0.3) * R,
      wy: (rng() * 2 - 1) * R,
      layer: assignLayer(rng()),
      surface: "right",
    });
  }

  // Back wall — spread, deepest layer
  for (let i = 0; i < BACK_WALL_COUNT; i++) {
    dots.push({
      wx: (rng() * 2 - 1) * R,
      wy: (rng() * 2 - 1) * R,
      layer: DEPTH_LAYERS - 1,
      surface: "back",
    });
  }

  // Ambient (free-floating)
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    dots.push({
      wx: (rng() * 2 - 1) * R,
      wy: (rng() * 2 - 1) * R,
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
  // Per-layer spring physics: position + velocity
  const springPosXRef = useRef(new Float32Array(DEPTH_LAYERS));
  const springPosYRef = useRef(new Float32Array(DEPTH_LAYERS));
  const springVelXRef = useRef(new Float32Array(DEPTH_LAYERS));
  const springVelYRef = useRef(new Float32Array(DEPTH_LAYERS));

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
      // Gimbal lock zone: when beta is ~90° from calibration,
      // gamma becomes unreliable. Freeze updates past ±70°.
      const rawBetaDiff = e.beta - betaOffsetRef.current;
      if (Math.abs(rawBetaDiff) > 70) return; // too close to gimbal lock

      const betaDiff = Math.max(-50, Math.min(50, rawBetaDiff));
      const gamma = Math.max(-45, Math.min(45, e.gamma));

      targetRef.current = {
        x: gamma / 35,
        y: betaDiff / 35,
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
    const spX = springPosXRef.current;
    const spY = springPosYRef.current;
    const svX = springVelXRef.current;
    const svY = springVelYRef.current;

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

      const tiltX = targetRef.current.x;
      const tiltY = targetRef.current.y;

      // Spring physics per layer (iOS-style: near=fast, far=heavy/laggy)
      for (let i = 0; i < DEPTH_LAYERS; i++) {
        const layerT = i / (DEPTH_LAYERS - 1);
        // Near layers: stiff spring, fast. Far layers: soft spring, heavy.
        const k = SPRING_K * (1.0 - layerT * 0.7);  // 0.08 → 0.024
        const damp = SPRING_DAMPING + layerT * 0.15; // 0.75 → 0.90

        // Spring force toward target
        const forceX = (tiltX - spX[i]) * k;
        const forceY = (tiltY - spY[i]) * k;
        svX[i] = svX[i] * damp + forceX;
        svY[i] = svY[i] * damp + forceY;
        spX[i] += svX[i];
        spY[i] += svY[i];
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;
      const spreadX = cw * 0.6;
      const spreadY = ch * 0.6;

      // Light source position shifts with tilt (smoothed via mid-layer spring)
      const midLayer = Math.floor(DEPTH_LAYERS / 3);
      const lightX = LIGHT_BASE_X + spX[midLayer] * LIGHT_TILT_FACTOR;
      const lightY = LIGHT_BASE_Y + spY[midLayer] * LIGHT_TILT_FACTOR;

      // --- Dots (far to near, already sorted) ---
      for (const dot of dots) {
        const layerT = dot.layer / (DEPTH_LAYERS - 1);
        const z = (dot.layer + 1) / DEPTH_LAYERS;
        // Stronger convergence: far dots squeeze tightly to center
        const convergence = 0.08 + (1 - z) * 0.92;

        // Subtle positional parallax (box feels slightly "peekable")
        const parallaxFactor = (1 - z) * MAX_SHIFT;
        const lx = spX[dot.layer];
        const ly = spY[dot.layer];
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
        const tX = spX[midLayer];
        const tY = spY[midLayer];
        if (dot.surface === "left") surfaceFactor = 1.0 + Math.max(0, -tX) * 1.2;
        else if (dot.surface === "right") surfaceFactor = 1.0 + Math.max(0, tX) * 1.2;
        else if (dot.surface === "floor") surfaceFactor = 1.0 + Math.max(0, tY) * 0.8;

        const alpha = baseAlpha * lightFactor * Math.max(0, edgeFactor) * surfaceFactor;

        if (alpha <= 0) continue;

        // Glow effect on near layers (bloom simulation)
        if (dot.layer < GLOW_LAYERS) {
          const glowT = 1 - dot.layer / GLOW_LAYERS;
          ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 0.7).toFixed(3)})`;
          ctx.shadowBlur = GLOW_RADIUS_MAX * glowT;
        } else {
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Reset shadow after dot loop
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

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
