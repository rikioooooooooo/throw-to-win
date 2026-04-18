"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Image-based parallax tunnel — uses a pre-rendered liminal space image.
 * The image is drawn larger than the screen (1.15x) and shifts with gyro tilt.
 * Spring physics for smooth iOS-like movement.
 */

type GyroTunnelProps = {
  readonly className?: string;
};

const OVERSHOOT = 1.15; // image drawn 15% larger than screen
const MAX_SHIFT = 30;   // max px shift at full tilt
const SPRING_K = 0.06;
const SPRING_DAMPING = 0.78;
const GYRO_TIMEOUT_MS = 2000;

export function GyroTunnel({ className }: GyroTunnelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Spring state
  const posRef = useRef({ x: 0, y: 0 });
  const velRef = useRef({ x: 0, y: 0 });

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Load tunnel image
    const img = new Image();
    img.onload = () => { imgRef.current = img; };
    img.src = "/tunnel-bg.webp";

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyroRef.current = true;
      if (!calibratedRef.current) {
        calibratedRef.current = true;
        betaOffsetRef.current = e.beta;
      }
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

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
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

      if (useFallback && !hasGyroRef.current) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.3) * 0.15,
          y: Math.cos(t * 0.45) * 0.08,
        };
      }

      // Spring physics
      const tx = targetRef.current.x * MAX_SHIFT;
      const ty = targetRef.current.y * MAX_SHIFT;
      const pos = posRef.current;
      const vel = velRef.current;

      const forceX = (tx - pos.x) * SPRING_K;
      const forceY = (ty - pos.y) * SPRING_K;
      vel.x = vel.x * SPRING_DAMPING + forceX;
      vel.y = vel.y * SPRING_DAMPING + forceY;
      pos.x += vel.x;
      pos.y += vel.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const image = imgRef.current;
      if (image) {
        // Draw image larger than screen, shifted by spring position
        const imgAspect = image.width / image.height;
        const screenAspect = cw / ch;

        let drawW: number;
        let drawH: number;

        if (imgAspect > screenAspect) {
          // Image is wider than screen — fit by height
          drawH = ch * OVERSHOOT;
          drawW = drawH * imgAspect;
        } else {
          // Image is taller — fit by width
          drawW = cw * OVERSHOOT;
          drawH = drawW / imgAspect;
        }

        const drawX = (cw - drawW) / 2 + pos.x;
        const drawY = (ch - drawH) / 2 + pos.y;

        ctx.drawImage(image, drawX, drawY, drawW, drawH);
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
