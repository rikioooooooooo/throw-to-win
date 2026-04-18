"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Multi-layer parallax from a single tunnel image.
 * The image is split into concentric rectangular rings (like an onion).
 * Outer rings = near = shift a lot. Inner rings = far = shift little.
 * This creates convincing 3D depth from one image.
 */

type GyroTunnelProps = {
  readonly className?: string;
};

const DEPTH_LAYERS = 20;
const OVERSHOOT = 1.2;
const MAX_SHIFT = 35;
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
  // Per-layer spring state
  const springPosX = useRef(new Float32Array(DEPTH_LAYERS));
  const springPosY = useRef(new Float32Array(DEPTH_LAYERS));
  const springVelX = useRef(new Float32Array(DEPTH_LAYERS));
  const springVelY = useRef(new Float32Array(DEPTH_LAYERS));

  const setCanvasRef = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

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
      targetRef.current = { x: gamma / 35, y: betaDiff / 35 };
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
    const spX = springPosX.current;
    const spY = springPosY.current;
    const svX = springVelX.current;
    const svY = springVelY.current;

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

      const tx = targetRef.current.x;
      const ty = targetRef.current.y;

      // Per-layer spring: near layers are snappy, far layers are heavy
      for (let i = 0; i < DEPTH_LAYERS; i++) {
        const layerT = i / (DEPTH_LAYERS - 1); // 0=nearest, 1=farthest
        const k = SPRING_K * (1.0 - layerT * 0.6);
        const damp = SPRING_DAMPING + layerT * 0.12;
        const shift = MAX_SHIFT * (1.0 - layerT * 0.85); // near=35px, far=5px

        const targetPx = tx * shift;
        const targetPy = ty * shift;
        const fx = (targetPx - spX[i]) * k;
        const fy = (targetPy - spY[i]) * k;
        svX[i] = svX[i] * damp + fx;
        svY[i] = svY[i] * damp + fy;
        spX[i] += svX[i];
        spY[i] += svY[i];
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      const image = imgRef.current;
      if (!image) { rafRef.current = requestAnimationFrame(draw); return; }

      // Compute base image draw rect (oversized to cover on tilt)
      const imgAspect = image.width / image.height;
      const screenAspect = cw / ch;
      let baseW: number, baseH: number;
      if (imgAspect > screenAspect) {
        baseH = ch * OVERSHOOT;
        baseW = baseH * imgAspect;
      } else {
        baseW = cw * OVERSHOOT;
        baseH = baseW / imgAspect;
      }

      // Draw each depth ring: clip to a concentric rectangular band, shift by layer's spring
      // Layer 0 = outermost ring (edges), Layer 7 = innermost (center)
      for (let i = 0; i < DEPTH_LAYERS; i++) {
        const layerT = i / DEPTH_LAYERS;
        const nextT = (i + 1) / DEPTH_LAYERS;

        // Non-linear inset: outer rings are wider (matching perspective)
        // pow(t, 0.6) gives more space near edges, tighter near center
        const outerInset = Math.pow(layerT, 0.6) * 0.48;
        const innerInset = Math.pow(nextT, 0.6) * 0.48;

        const outerL = cw * outerInset;
        const outerT_y = ch * outerInset;
        const outerR = cw * (1 - outerInset);
        const outerB = ch * (1 - outerInset);

        const innerL = cw * innerInset;
        const innerT_y = ch * innerInset;
        const innerR = cw * (1 - innerInset);
        const innerB = ch * (1 - innerInset);

        ctx.save();

        // Create clip path: outer rect minus inner rect (ring shape)
        ctx.beginPath();
        // Outer rect (clockwise)
        ctx.rect(outerL, outerT_y, outerR - outerL, outerB - outerT_y);
        // Inner rect (counter-clockwise = hole)
        ctx.moveTo(innerL, innerT_y);
        ctx.lineTo(innerL, innerB);
        ctx.lineTo(innerR, innerB);
        ctx.lineTo(innerR, innerT_y);
        ctx.closePath();
        ctx.clip("evenodd");

        // Draw the full image shifted by this layer's parallax
        const drawX = (cw - baseW) / 2 + spX[i];
        const drawY = (ch - baseH) / 2 + spY[i];
        ctx.drawImage(image, drawX, drawY, baseW, baseH);

        ctx.restore();
      }

      // Draw the innermost center
      {
        const inset = Math.pow(1.0, 0.6) * 0.48;
        const centerL = cw * inset;
        const centerT = ch * inset;
        const centerR = cw * (1 - inset);
        const centerB = ch * (1 - inset);
        ctx.save();
        ctx.beginPath();
        ctx.rect(centerL, centerT, centerR - centerL, centerB - centerT);
        ctx.clip();
        const drawX = (cw - baseW) / 2 + spX[DEPTH_LAYERS - 1] * 0.3;
        const drawY = (ch - baseH) / 2 + spY[DEPTH_LAYERS - 1] * 0.3;
        ctx.drawImage(image, drawX, drawY, baseW, baseH);
        ctx.restore();
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
