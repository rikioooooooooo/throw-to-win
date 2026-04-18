"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * True 3D perspective tunnel with optic flow.
 * Dots live in world-space (x, y, z) and are projected via
 * pinhole camera model. Gyroscope shifts camera position,
 * producing natural parallax (near dots shift a lot, far barely move).
 */

type GyroBarsProps = {
  readonly className?: string;
};

// ── Constants ──────────────────────────────────────────────
const TOTAL_DOTS = 2000;
const FOCAL = 400;
const Z_NEAR = 30;
const Z_FAR = 2000;
const TUNNEL_W = 300;
const TUNNEL_H = 500;
const FLOW_SPEED = 0; // no animation — depth from gyro + light + size only
const CAMERA_SHIFT = 12; // very subtle — box is attached to phone, not floating
const BASE_RADIUS = 2.5;
const BASE_ALPHA = 0.8;

const GYRO_TIMEOUT_MS = 2000;
const SPRING_K = 0.08;
const SPRING_DAMPING = 0.75;

// Chromostereopsis color anchors
const COLOR_NEAR: readonly [number, number, number] = [180, 255, 200];
const COLOR_MID: readonly [number, number, number] = [0, 250, 154];
const COLOR_FAR: readonly [number, number, number] = [0, 100, 120];

// ── Helpers ────────────────────────────────────────────────
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function colorForZ(z: number): [number, number, number] {
  const t = clamp((z - Z_NEAR) / (Z_FAR - Z_NEAR), 0, 1);
  if (t < 0.5) {
    // near → mid
    const s = t / 0.5;
    return [
      Math.round(lerp(COLOR_NEAR[0], COLOR_MID[0], s)),
      Math.round(lerp(COLOR_NEAR[1], COLOR_MID[1], s)),
      Math.round(lerp(COLOR_NEAR[2], COLOR_MID[2], s)),
    ];
  }
  // mid → far
  const s = (t - 0.5) / 0.5;
  return [
    Math.round(lerp(COLOR_MID[0], COLOR_FAR[0], s)),
    Math.round(lerp(COLOR_MID[1], COLOR_FAR[1], s)),
    Math.round(lerp(COLOR_MID[2], COLOR_FAR[2], s)),
  ];
}

// ── Dot initialisation (typed arrays) ──────────────────────
function initDots(
  dotX: Float32Array,
  dotY: Float32Array,
  dotZ: Float32Array,
  startIdx: number,
  count: number,
  rng: () => number,
): void {
  // 85% wall/corner, 15% ambient — room feel, not space
  for (let i = 0; i < count; i++) {
    const idx = startIdx + i;
    const zVal = Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(rng(), 0.5);
    dotZ[idx] = zVal;

    const r = rng();
    if (r < 0.20) {
      // Left wall — x fixed near left edge
      dotX[idx] = -(TUNNEL_W / 2) * (0.88 + rng() * 0.12);
      dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2);
    } else if (r < 0.40) {
      // Right wall
      dotX[idx] = (TUNNEL_W / 2) * (0.88 + rng() * 0.12);
      dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2);
    } else if (r < 0.55) {
      // Top wall (ceiling)
      dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2);
      dotY[idx] = -(TUNNEL_H / 2) * (0.88 + rng() * 0.12);
    } else if (r < 0.70) {
      // Bottom wall (floor)
      dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2);
      dotY[idx] = (TUNNEL_H / 2) * (0.88 + rng() * 0.12);
    } else if (r < 0.85) {
      // Corner edges — where two walls meet (makes box shape visible)
      const cornerX = (TUNNEL_W / 2) * (rng() > 0.5 ? 1 : -1) * (0.90 + rng() * 0.10);
      const cornerY = (TUNNEL_H / 2) * (rng() > 0.5 ? 1 : -1) * (0.90 + rng() * 0.10);
      dotX[idx] = cornerX;
      dotY[idx] = cornerY;
    } else {
      // Ambient — sparse dots in the middle (floating dust)
      dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2) * 0.6;
      dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2) * 0.6;
    }
  }
}

function resetDot(
  dotX: Float32Array,
  dotY: Float32Array,
  dotZ: Float32Array,
  idx: number,
  rng: () => number,
): void {
  dotZ[idx] = Z_FAR;
  const r = rng();
  if (r < 0.20) {
    dotX[idx] = -(TUNNEL_W / 2) * (0.88 + rng() * 0.12);
    dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2);
  } else if (r < 0.40) {
    dotX[idx] = (TUNNEL_W / 2) * (0.88 + rng() * 0.12);
    dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2);
  } else if (r < 0.55) {
    dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2);
    dotY[idx] = -(TUNNEL_H / 2) * (0.88 + rng() * 0.12);
  } else if (r < 0.70) {
    dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2);
    dotY[idx] = (TUNNEL_H / 2) * (0.88 + rng() * 0.12);
  } else if (r < 0.85) {
    dotX[idx] = (TUNNEL_W / 2) * (rng() > 0.5 ? 1 : -1) * (0.90 + rng() * 0.10);
    dotY[idx] = (TUNNEL_H / 2) * (rng() > 0.5 ? 1 : -1) * (0.90 + rng() * 0.10);
  } else {
    dotX[idx] = (rng() * 2 - 1) * (TUNNEL_W / 2) * 0.6;
    dotY[idx] = (rng() * 2 - 1) * (TUNNEL_H / 2) * 0.6;
  }
}

// ── Component ──────────────────────────────────────────────
export function GyroBars({ className }: GyroBarsProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const vignetteRef = useRef<CanvasGradient | null>(null);
  const vignetteSizeRef = useRef({ w: 0, h: 0 });

  // Camera spring state
  const camPosXRef = useRef(0);
  const camPosYRef = useRef(0);
  const camVelXRef = useRef(0);
  const camVelYRef = useRef(0);

  // Pre-allocated typed arrays for dot data
  const dotXRef = useRef(new Float32Array(TOTAL_DOTS));
  const dotYRef = useRef(new Float32Array(TOTAL_DOTS));
  const dotZRef = useRef(new Float32Array(TOTAL_DOTS));
  // Sort indices array (avoids sorting full objects)
  const sortIdxRef = useRef(new Uint16Array(TOTAL_DOTS));
  // Persistent RNG for dot recycling
  const rngRef = useRef(seededRandom(42));

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // ── Gyro handling (kept identical to original) ──
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      if (!calibratedRef.current) {
        calibratedRef.current = true;
        betaOffsetRef.current = e.beta;
      }
      // Gimbal lock prevention: freeze past ±70°
      const rawBetaDiff = e.beta - betaOffsetRef.current;
      if (Math.abs(rawBetaDiff) > 70) return;

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

    // ── Canvas setup ──
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

    // ── Initialise dots ──
    const rng = rngRef.current;
    const dotX = dotXRef.current;
    const dotY = dotYRef.current;
    const dotZ = dotZRef.current;
    const sortIdx = sortIdxRef.current;

    initDots(dotX, dotY, dotZ, 0, TOTAL_DOTS, rng);
    for (let i = 0; i < TOTAL_DOTS; i++) sortIdx[i] = i;

    const startTime = performance.now();
    let prevTime = startTime;

    // ── Draw loop ──
    const draw = (now: number) => {
      const dt = Math.min((now - prevTime) / 1000, 0.1); // cap to 100ms
      prevTime = now;

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

      // ── Camera spring physics ──
      const camTargetX = tiltX * CAMERA_SHIFT;
      const camTargetY = tiltY * CAMERA_SHIFT;

      const forceX = (camTargetX - camPosXRef.current) * SPRING_K;
      const forceY = (camTargetY - camPosYRef.current) * SPRING_K;
      camVelXRef.current = camVelXRef.current * SPRING_DAMPING + forceX;
      camVelYRef.current = camVelYRef.current * SPRING_DAMPING + forceY;
      camPosXRef.current += camVelXRef.current;
      camPosYRef.current += camVelYRef.current;

      const cameraX = camPosXRef.current;
      const cameraY = camPosYRef.current;

      // ── Optic flow: advance dots toward camera ──
      const flowStep = FLOW_SPEED * dt;
      for (let i = 0; i < TOTAL_DOTS; i++) {
        dotZ[i] -= flowStep;
        if (dotZ[i] < Z_NEAR) {
          resetDot(dotX, dotY, dotZ, i, rng);
        }
      }

      // ── Z-sort: far first (descending z) ──
      // Sort indices only — compare via dotZ typed array
      for (let i = 0; i < TOTAL_DOTS; i++) sortIdx[i] = i;
      sortIdx.sort((a, b) => dotZ[b] - dotZ[a]);

      // ── Clear ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const cx = cw / 2;
      const cy = ch / 2;

      // ── Draw dots ──
      for (let si = 0; si < TOTAL_DOTS; si++) {
        const i = sortIdx[si];
        const z = dotZ[i];
        if (z <= 0) continue;

        const scale = FOCAL / z;
        const screenX = cx + (dotX[i] - cameraX) * scale;
        const screenY = cy + (dotY[i] - cameraY) * scale;
        const radius = BASE_RADIUS * scale;

        // Early cull
        if (
          screenX < -radius ||
          screenX > cw + radius ||
          screenY < -radius ||
          screenY > ch + radius
        )
          continue;

        let alpha = clamp(BASE_ALPHA * scale, 0, 1);
        if (alpha <= 0.005) continue;

        // Wall lighting: tilt brightens the wall you're looking "down" at
        const dx = dotX[i];
        const dy = dotY[i];
        const halfW = TUNNEL_W / 2;
        const halfH = TUNNEL_H / 2;
        // Is this dot on a wall? Check proximity to edges
        const onLeftWall = dx < -halfW * 0.85;
        const onRightWall = dx > halfW * 0.85;
        const onTopWall = dy < -halfH * 0.85;
        const onBottomWall = dy > halfH * 0.85;

        if (onRightWall) alpha *= 1.0 + clamp(tiltX, 0, 1) * 0.8;
        else if (onLeftWall) alpha *= 1.0 + clamp(-tiltX, 0, 1) * 0.8;
        if (onBottomWall) alpha *= 1.0 + clamp(tiltY, 0, 1) * 0.6;
        else if (onTopWall) alpha *= 1.0 + clamp(-tiltY, 0, 1) * 0.6;
        alpha = clamp(alpha, 0, 1);

        const [cr, cg, cb] = colorForZ(z);

        // Glow on near dots
        if (z < 200) {
          const glowStrength = (200 - z) / 200;
          ctx.shadowBlur = glowStrength * 15;
          ctx.shadowColor = `rgba(${cr}, ${cg}, ${cb}, ${(alpha * 0.5).toFixed(3)})`;
        } else {
          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
        }

        ctx.beginPath();
        ctx.arc(screenX, screenY, Math.max(radius, 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;

      // ── Vignette ──
      if (
        vignetteSizeRef.current.w !== cw ||
        vignetteSizeRef.current.h !== ch
      ) {
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
