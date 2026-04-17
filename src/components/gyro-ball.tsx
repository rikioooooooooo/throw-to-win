"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible heavy ball physics — vibration only, no visual.
 * Creates the illusion of a heavy ball rattling inside the phone
 * by triggering haptic feedback on wall collisions proportional to impact speed.
 */

const RESTITUTION = 0.6;
const FRICTION = 0.997;
const GRAVITY_SCALE = 800; // px/s² per degree of tilt — heavier feel
const FIXED_DT = 1 / 60;
const HAPTIC_THROTTLE_MS = 30;
const GYRO_TIMEOUT_MS = 1500;
/** Minimum impact speed (px/s) to trigger vibration */
const MIN_IMPACT_SPEED = 40;

/** Map impact speed to vibration duration (ms). Heavier hit = longer buzz. */
function impactToVibeDuration(speed: number): number {
  if (speed < MIN_IMPACT_SPEED) return 0;
  // 40 px/s → 3ms, 400+ px/s → 25ms, clamped
  return Math.min(25, Math.round(3 + (speed - MIN_IMPACT_SPEED) * 0.055));
}

export function GyroBall() {
  const ballRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
  const gravityRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const lastVibrateRef = useRef(0);
  const rafRef = useRef(0);
  const accRef = useRef(0);
  const lastTimeRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    // Reduced motion: skip entirely
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // No vibration API: skip entirely
    if (typeof navigator.vibrate !== "function") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      hasGyroRef.current = true;
      // gamma: left-right tilt (-90..90), beta: front-back tilt (-180..180)
      gravityRef.current = {
        x: (e.gamma ?? 0) * GRAVITY_SCALE / 60,
        y: (e.beta ?? 0) * GRAVITY_SCALE / 60,
      };
    };

    window.addEventListener("deviceorientation", handleOrientation);

    // If no gyro events within timeout, clean up — no fallback drift
    // (vibration without gyro input would feel random and weird)
    const gyroTimer = setTimeout(() => {
      if (!hasGyroRef.current) {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener("deviceorientation", handleOrientation);
      }
    }, GYRO_TIMEOUT_MS);

    // Initialize ball at center
    const w = window.innerWidth;
    const h = window.innerHeight;
    sizeRef.current = { w, h };
    ballRef.current = { x: w / 2, y: h / 2, vx: 0, vy: 0 };

    const handleResize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight };
    };
    window.addEventListener("resize", handleResize);

    const doVibrate = (speed: number) => {
      const dur = impactToVibeDuration(speed);
      if (dur <= 0) return;
      const now = performance.now();
      if (now - lastVibrateRef.current < HAPTIC_THROTTLE_MS) return;
      navigator.vibrate(dur);
      lastVibrateRef.current = now;
    };

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      accRef.current += dt;

      const { w, h } = sizeRef.current;
      const gx = gravityRef.current.x;
      const gy = gravityRef.current.y;
      const ball = ballRef.current;

      while (accRef.current >= FIXED_DT) {
        ball.vx += gx;
        ball.vy += gy;
        ball.vx *= FRICTION;
        ball.vy *= FRICTION;
        ball.x += ball.vx * FIXED_DT;
        ball.y += ball.vy * FIXED_DT;

        // Wall collisions — vibrate proportional to impact speed
        if (ball.x < 0) {
          doVibrate(Math.abs(ball.vx));
          ball.x = 0;
          ball.vx = Math.abs(ball.vx) * RESTITUTION;
        } else if (ball.x > w) {
          doVibrate(Math.abs(ball.vx));
          ball.x = w;
          ball.vx = -Math.abs(ball.vx) * RESTITUTION;
        }
        if (ball.y < 0) {
          doVibrate(Math.abs(ball.vy));
          ball.y = 0;
          ball.vy = Math.abs(ball.vy) * RESTITUTION;
        } else if (ball.y > h) {
          doVibrate(Math.abs(ball.vy));
          ball.y = h;
          ball.vy = -Math.abs(ball.vy) * RESTITUTION;
        }

        accRef.current -= FIXED_DT;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(gyroTimer);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Renders nothing — haptics only
  return null;
}
