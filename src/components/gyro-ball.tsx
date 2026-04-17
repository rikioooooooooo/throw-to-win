"use client";

import { useEffect, useRef, useCallback } from "react";

type GyroBallProps = {
  className?: string;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  trail: Array<{ x: number; y: number }>;
};

const BALL_RADII = [12, 14, 15, 16, 18];
const TRAIL_LENGTH = 5;
const RESTITUTION = 0.5;
const AIR_FRICTION = 0.995;
const GRAVITY_SCALE = 0.15;
const HAPTIC_THROTTLE_MS = 50;
const GYRO_TIMEOUT_MS = 2000;
const FIXED_DT = 1 / 60;

function vibrate(durationMs: number, lastVibrateRef: React.MutableRefObject<number>): void {
  const now = performance.now();
  if (now - lastVibrateRef.current < HAPTIC_THROTTLE_MS) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(durationMs);
  }
  lastVibrateRef.current = now;
}

function createBalls(width: number, height: number): Ball[] {
  return BALL_RADII.map((radius) => ({
    x: radius + Math.random() * (width - radius * 2),
    y: radius + Math.random() * (height - radius * 2),
    vx: (Math.random() - 0.5) * 60,
    vy: (Math.random() - 0.5) * 60,
    radius,
    trail: [],
  }));
}

function resolveWallCollisions(
  ball: Ball,
  w: number,
  h: number,
  lastVibrateRef: React.MutableRefObject<number>,
): void {
  if (ball.x - ball.radius < 0) {
    ball.x = ball.radius;
    ball.vx = Math.abs(ball.vx) * RESTITUTION;
    vibrate(8, lastVibrateRef);
  } else if (ball.x + ball.radius > w) {
    ball.x = w - ball.radius;
    ball.vx = -Math.abs(ball.vx) * RESTITUTION;
    vibrate(8, lastVibrateRef);
  }
  if (ball.y - ball.radius < 0) {
    ball.y = ball.radius;
    ball.vy = Math.abs(ball.vy) * RESTITUTION;
    vibrate(8, lastVibrateRef);
  } else if (ball.y + ball.radius > h) {
    ball.y = h - ball.radius;
    ball.vy = -Math.abs(ball.vy) * RESTITUTION;
    vibrate(8, lastVibrateRef);
  }
}

function resolveBallCollisions(
  balls: Ball[],
  lastVibrateRef: React.MutableRefObject<number>,
): void {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const minDist = a.radius + b.radius;

      if (distSq < minDist * minDist && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping balls
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        // Elastic velocity exchange along collision normal
        const dvx = a.vx - b.vx;
        const dvy = a.vy - b.vy;
        const dot = dvx * nx + dvy * ny;

        if (dot > 0) {
          a.vx -= dot * nx;
          a.vy -= dot * ny;
          b.vx += dot * nx;
          b.vy += dot * ny;
          vibrate(4, lastVibrateRef);
        }
      }
    }
  }
}

function drawBalls(ctx: CanvasRenderingContext2D, balls: readonly Ball[]): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const ball of balls) {
    // Draw trail (fading older positions)
    for (let t = 0; t < ball.trail.length; t++) {
      const pos = ball.trail[t];
      const alpha = ((t + 1) / ball.trail.length) * 0.08;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, ball.radius * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 250, 154, ${alpha})`;
      ctx.fill();
    }

    // Draw ball with glow
    ctx.save();
    ctx.shadowColor = "rgba(0, 250, 154, 0.2)";
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 250, 154, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 250, 154, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}

export function GyroBall({ className }: GyroBallProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ballsRef = useRef<Ball[]>([]);
  const gravityRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const gyroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const useFallbackRef = useRef(false);
  const lastVibrateRef = useRef(0);
  const rafRef = useRef(0);
  const accumulatorRef = useRef(0);
  const lastTimeRef = useRef(0);
  const startTimeRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  // Device orientation listener
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      hasGyroRef.current = true;
      const gamma = e.gamma ?? 0; // left-right tilt
      const beta = e.beta ?? 0;   // front-back tilt
      gravityRef.current = {
        x: gamma * GRAVITY_SCALE,
        y: beta * GRAVITY_SCALE,
      };
    };

    window.addEventListener("deviceorientation", handleOrientation);

    // Fallback timer: if no gyro events fire within 2s, enable drift mode
    gyroTimerRef.current = setTimeout(() => {
      if (!hasGyroRef.current) {
        useFallbackRef.current = true;
      }
    }, GYRO_TIMEOUT_MS);

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      if (gyroTimerRef.current !== null) {
        clearTimeout(gyroTimerRef.current);
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check reduced motion preference
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      reducedMotionRef.current = true;
    }

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // Reinitialize balls if canvas is valid size
      if (rect.width > 0 && rect.height > 0 && ballsRef.current.length === 0) {
        ballsRef.current = createBalls(rect.width, rect.height);
      }
    };

    updateCanvasSize();

    const handleResize = () => {
      updateCanvasSize();
    };
    window.addEventListener("resize", handleResize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Static render for reduced motion
    if (reducedMotionRef.current) {
      const parent = canvas.parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        if (ballsRef.current.length === 0) {
          ballsRef.current = createBalls(rect.width, rect.height);
        }
        drawBalls(ctx, ballsRef.current);
      }
      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    startTimeRef.current = performance.now();
    lastTimeRef.current = performance.now();
    accumulatorRef.current = 0;

    const loop = (now: number) => {
      const parent = canvas.parentElement;
      if (!parent) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const rect = parent.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const frameTime = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      accumulatorRef.current += frameTime;

      // Update fallback gravity if no gyroscope
      if (useFallbackRef.current) {
        const elapsed = (now - startTimeRef.current) / 1000;
        gravityRef.current = {
          x: Math.sin(elapsed * 0.3) * 2,
          y: Math.cos(elapsed * 0.5) * 2,
        };
      }

      const gx = gravityRef.current.x;
      const gy = gravityRef.current.y;
      const balls = ballsRef.current;

      // Fixed timestep physics
      while (accumulatorRef.current >= FIXED_DT) {
        for (const ball of balls) {
          ball.vx += gx * FIXED_DT;
          ball.vy += gy * FIXED_DT;
          ball.vx *= AIR_FRICTION;
          ball.vy *= AIR_FRICTION;
          ball.x += ball.vx * FIXED_DT;
          ball.y += ball.vy * FIXED_DT;
        }

        for (const ball of balls) {
          resolveWallCollisions(ball, w, h, lastVibrateRef);
        }

        resolveBallCollisions(balls, lastVibrateRef);

        // Clamp positions
        for (const ball of balls) {
          ball.x = Math.max(ball.radius, Math.min(w - ball.radius, ball.x));
          ball.y = Math.max(ball.radius, Math.min(h - ball.radius, ball.y));
        }

        accumulatorRef.current -= FIXED_DT;
      }

      // Update trails
      for (const ball of balls) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > TRAIL_LENGTH) {
          ball.trail.shift();
        }
      }

      drawBalls(ctx, balls);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", handleResize);
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
