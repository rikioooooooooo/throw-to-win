"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax poles + a ball that flies through depth layers.
 * Tilt left/right → ball moves horizontally.
 * Tilt forward/back → ball moves deeper/closer.
 * The ball follows the same perspective rules as the poles.
 */

type GyroBarsProps = {
  readonly className?: string;
};

type Pole = {
  readonly wx: number;
  readonly wy: number;
  readonly z: number;
};

type Ball3D = {
  x: number;  // normalized -1..1
  y: number;
  z: number;  // 0.05 (nearest) .. 1.0 (furthest)
  vx: number;
  vy: number;
  vz: number;
};

const GRID_COLS = 15;
const GRID_ROWS = 24;
const DEPTH_LAYERS = 12;
const MAX_SHIFT = 90;
const LERP = 0.06;
const GYRO_TIMEOUT_MS = 2000;
const FIXED_DT = 1 / 60;

// Ball physics
const BALL_FRICTION = 0.985;
const BALL_GRAVITY_XY = 3.0;
const BALL_GRAVITY_Z = 2.5;
const BALL_RESTITUTION = 0.5;
const BALL_Z_MIN = 0.05;
const BALL_Z_MAX = 1.0;
const BALL_XY_LIMIT = 1.4;
const BALL_BASE_RADIUS = 8;

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 - 1,
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
  const ballRef = useRef<Ball3D>({
    x: 0, y: 0, z: 0.5,
    vx: 0, vy: 0, vz: 0,
  });
  const accRef = useRef(0);
  const lastTimeRef = useRef(0);

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
    lastTimeRef.current = performance.now();
    const poles = polesRef.current;

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

      // Smooth tilt interpolation
      currentRef.current = {
        x: currentRef.current.x + (targetRef.current.x - currentRef.current.x) * LERP,
        y: currentRef.current.y + (targetRef.current.y - currentRef.current.y) * LERP,
      };

      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      // --- Ball physics (fixed timestep) ---
      const frameTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      accRef.current += frameTime;

      const ball = ballRef.current;
      while (accRef.current >= FIXED_DT) {
        // Tilt → gravity: X from gamma, Z from beta (forward=deeper)
        ball.vx += tiltX * BALL_GRAVITY_XY * FIXED_DT;
        ball.vy += tiltY * BALL_GRAVITY_XY * FIXED_DT * 0.4;
        ball.vz += tiltY * BALL_GRAVITY_Z * FIXED_DT;

        ball.vx *= BALL_FRICTION;
        ball.vy *= BALL_FRICTION;
        ball.vz *= BALL_FRICTION;

        ball.x += ball.vx * FIXED_DT;
        ball.y += ball.vy * FIXED_DT;
        ball.z += ball.vz * FIXED_DT;

        // Bounce off XY walls
        if (ball.x < -BALL_XY_LIMIT) { ball.x = -BALL_XY_LIMIT; ball.vx = Math.abs(ball.vx) * BALL_RESTITUTION; }
        if (ball.x > BALL_XY_LIMIT) { ball.x = BALL_XY_LIMIT; ball.vx = -Math.abs(ball.vx) * BALL_RESTITUTION; }
        if (ball.y < -BALL_XY_LIMIT) { ball.y = -BALL_XY_LIMIT; ball.vy = Math.abs(ball.vy) * BALL_RESTITUTION; }
        if (ball.y > BALL_XY_LIMIT) { ball.y = BALL_XY_LIMIT; ball.vy = -Math.abs(ball.vy) * BALL_RESTITUTION; }

        // Bounce off Z walls (near/far)
        if (ball.z < BALL_Z_MIN) { ball.z = BALL_Z_MIN; ball.vz = Math.abs(ball.vz) * BALL_RESTITUTION; }
        if (ball.z > BALL_Z_MAX) { ball.z = BALL_Z_MAX; ball.vz = -Math.abs(ball.vz) * BALL_RESTITUTION; }

        accRef.current -= FIXED_DT;
      }

      // --- Rendering ---
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const centerX = cw / 2;
      const centerY = ch / 2;
      const spreadX = cw * 0.65;
      const spreadY = ch * 0.65;

      // Compute ball screen position & radius using same perspective as poles
      const ballPScale = 1 / (0.15 + ball.z * 0.85);
      const ballParallax = (1 - ball.z) * MAX_SHIFT;
      const ballSx = centerX + ball.x * spreadX + tiltX * ballParallax;
      const ballSy = centerY + ball.y * spreadY + tiltY * ballParallax * 0.6;
      const ballRadius = BALL_BASE_RADIUS * ballPScale;
      const ballAlpha = 0.3 + (1 - ball.z) * 0.7;

      // Draw: poles behind ball → ball → poles in front of ball
      let ballDrawn = false;

      for (const pole of poles) {
        // If this pole is nearer than the ball and ball not drawn yet, draw ball
        if (!ballDrawn && pole.z < ball.z) {
          drawBall(ctx, ballSx, ballSy, ballRadius, ballAlpha);
          ballDrawn = true;
        }

        const perspectiveScale = 1 / (0.15 + pole.z * 0.85);
        const parallaxFactor = (1 - pole.z) * MAX_SHIFT;

        const sx = centerX + pole.wx * spreadX + tiltX * parallaxFactor;
        const sy = centerY + pole.wy * spreadY + tiltY * parallaxFactor * 0.6;

        const radius = 4.5 * perspectiveScale;
        const depthFog = Math.pow(1 - pole.z, 1.2);
        const alpha = 0.05 + depthFog * 0.38;

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // Ball is furthest back — draw after all poles
      if (!ballDrawn) {
        drawBall(ctx, ballSx, ballSy, ballRadius, ballAlpha);
      }

      // Vignette
      if (vignetteSizeRef.current.w !== cw || vignetteSizeRef.current.h !== ch) {
        const diag = Math.sqrt(centerX * centerX + centerY * centerY);
        const grad = ctx.createRadialGradient(centerX, centerY, diag * 0.5, centerX, centerY, diag);
        grad.addColorStop(0, "rgba(5, 5, 8, 0)");
        grad.addColorStop(0.8, "rgba(5, 5, 8, 0.06)");
        grad.addColorStop(1, "rgba(5, 5, 8, 0.2)");
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

/** Draw the ball with glow effect */
function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number,
): void {
  // Outer glow
  ctx.save();
  ctx.shadowColor = `rgba(0, 250, 154, ${(alpha * 0.6).toFixed(3)})`;
  ctx.shadowBlur = radius * 1.5;

  // Ball fill — white-ish center for contrast against green poles
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${(alpha * 0.9).toFixed(3)})`;
  ctx.fill();

  // Accent ring
  ctx.strokeStyle = `rgba(0, 250, 154, ${alpha.toFixed(3)})`;
  ctx.lineWidth = Math.max(1.5, radius * 0.15);
  ctx.stroke();

  ctx.restore();
}
