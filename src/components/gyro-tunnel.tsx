"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * TikTok-style nested rectangle parallax tunnel.
 * 10 nested frames create a box/tunnel illusion.
 * Each frame shifts at a different rate on tilt —
 * near frames move a lot, far frames barely move.
 */

type GyroTunnelProps = {
  readonly className?: string;
};

const FRAME_COUNT = 10;
const MAX_SHIFT = 35;
const OVERSHOOT = 1.2;
const GYRO_TIMEOUT_MS = 2000;
const SPRING_K = 0.08;
const SPRING_DAMPING = 0.75;

// Wall color: mint/cyan
const WALL_R = 0;
const WALL_G = 250;
const WALL_B = 154;

// Alpha ranges
const WALL_FILL_ALPHA_NEAR = 0.07;
const WALL_FILL_ALPHA_FAR = 0.02;
const EDGE_LINE_ALPHA_NEAR = 0.12;
const EDGE_LINE_ALPHA_FAR = 0.03;
const FLOOR_ALPHA = 0.015;

// Grid line count per wall surface
const GRID_LINES_PER_WALL = 3;
const GRID_LINE_ALPHA = 0.02;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function GyroTunnel({ className }: GyroTunnelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const hasGyroRef = useRef(false);
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const vignetteRef = useRef<CanvasGradient | null>(null);
  const vignetteSizeRef = useRef({ w: 0, h: 0 });

  // Per-layer spring physics: position + velocity
  const springPosXRef = useRef(new Float32Array(FRAME_COUNT));
  const springPosYRef = useRef(new Float32Array(FRAME_COUNT));
  const springVelXRef = useRef(new Float32Array(FRAME_COUNT));
  const springVelYRef = useRef(new Float32Array(FRAME_COUNT));

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
      // Gimbal lock zone: beta ~90deg from calibration makes gamma unreliable
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
      vignetteSizeRef.current = { w: 0, h: 0 };
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();
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

      // Spring physics per layer (near=fast/snappy, far=slow/heavy)
      for (let i = 0; i < FRAME_COUNT; i++) {
        const layerT = i / (FRAME_COUNT - 1);
        const k = SPRING_K * (1.0 - layerT * 0.7);
        const damp = SPRING_DAMPING + layerT * 0.15;

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

      // Compute rect for each frame layer
      // Frame 0 (nearest) = slightly outside screen edges (OVERSHOOT)
      // Frame 9 (deepest) = ~25% of screen centered
      const rects: Array<{
        left: number;
        top: number;
        right: number;
        bottom: number;
      }> = [];

      for (let i = 0; i < FRAME_COUNT; i++) {
        const t = i / (FRAME_COUNT - 1); // 0=nearest, 1=deepest
        // Size shrinks from OVERSHOOT (1.2x half-screen) to 0.25x half-screen
        const halfW = lerp(cx * OVERSHOOT, cx * 0.25, t);
        const halfH = lerp(cy * OVERSHOOT, cy * 0.25, t);
        // Parallax shift: near frames shift a lot, far barely
        const parallaxFactor = lerp(MAX_SHIFT, 2, t);
        const shiftX = spX[i] * parallaxFactor;
        const shiftY = spY[i] * parallaxFactor;

        rects.push({
          left: cx - halfW + shiftX,
          top: cy - halfH + shiftY,
          right: cx + halfW + shiftX,
          bottom: cy + halfH + shiftY,
        });
      }

      // Draw wall surfaces (trapezoids between consecutive frames)
      // Draw from deepest to nearest so near layers paint on top
      for (let i = FRAME_COUNT - 2; i >= 0; i--) {
        const outer = rects[i];
        const inner = rects[i + 1];
        const depthT = i / (FRAME_COUNT - 1);

        const fillAlpha = lerp(WALL_FILL_ALPHA_NEAR, WALL_FILL_ALPHA_FAR, depthT);
        const edgeAlpha = lerp(EDGE_LINE_ALPHA_NEAR, EDGE_LINE_ALPHA_FAR, depthT);

        const fillColor = `rgba(${WALL_R}, ${WALL_G}, ${WALL_B}, ${fillAlpha.toFixed(4)})`;
        const edgeColor = `rgba(${WALL_R}, ${WALL_G}, ${WALL_B}, ${edgeAlpha.toFixed(4)})`;

        // Top wall trapezoid
        ctx.beginPath();
        ctx.moveTo(outer.left, outer.top);
        ctx.lineTo(outer.right, outer.top);
        ctx.lineTo(inner.right, inner.top);
        ctx.lineTo(inner.left, inner.top);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Bottom wall trapezoid
        ctx.beginPath();
        ctx.moveTo(outer.left, outer.bottom);
        ctx.lineTo(outer.right, outer.bottom);
        ctx.lineTo(inner.right, inner.bottom);
        ctx.lineTo(inner.left, inner.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Left wall trapezoid
        ctx.beginPath();
        ctx.moveTo(outer.left, outer.top);
        ctx.lineTo(inner.left, inner.top);
        ctx.lineTo(inner.left, inner.bottom);
        ctx.lineTo(outer.left, outer.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Right wall trapezoid
        ctx.beginPath();
        ctx.moveTo(outer.right, outer.top);
        ctx.lineTo(inner.right, inner.top);
        ctx.lineTo(inner.right, inner.bottom);
        ctx.lineTo(outer.right, outer.bottom);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();

        // Edge lines on each frame boundary
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(
          outer.left,
          outer.top,
          outer.right - outer.left,
          outer.bottom - outer.top,
        );
        ctx.stroke();

        // Grid lines on wall surfaces for texture
        const gridAlphaStr = `rgba(${WALL_R}, ${WALL_G}, ${WALL_B}, ${(GRID_LINE_ALPHA * (1 - depthT)).toFixed(4)})`;
        ctx.strokeStyle = gridAlphaStr;
        ctx.lineWidth = 0.5;

        for (let g = 1; g <= GRID_LINES_PER_WALL; g++) {
          const gt = g / (GRID_LINES_PER_WALL + 1);

          // Horizontal lines on left wall
          const lyLeft = lerp(outer.top, outer.bottom, gt);
          const lyLeftInner = lerp(inner.top, inner.bottom, gt);
          ctx.beginPath();
          ctx.moveTo(outer.left, lyLeft);
          ctx.lineTo(inner.left, lyLeftInner);
          ctx.stroke();

          // Horizontal lines on right wall
          const lyRight = lerp(outer.top, outer.bottom, gt);
          const lyRightInner = lerp(inner.top, inner.bottom, gt);
          ctx.beginPath();
          ctx.moveTo(outer.right, lyRight);
          ctx.lineTo(inner.right, lyRightInner);
          ctx.stroke();

          // Vertical lines on top wall
          const lxTop = lerp(outer.left, outer.right, gt);
          const lxTopInner = lerp(inner.left, inner.right, gt);
          ctx.beginPath();
          ctx.moveTo(lxTop, outer.top);
          ctx.lineTo(lxTopInner, inner.top);
          ctx.stroke();

          // Vertical lines on bottom wall
          const lxBot = lerp(outer.left, outer.right, gt);
          const lxBotInner = lerp(inner.left, inner.right, gt);
          ctx.beginPath();
          ctx.moveTo(lxBot, outer.bottom);
          ctx.lineTo(lxBotInner, inner.bottom);
          ctx.stroke();
        }
      }

      // Deepest rectangle floor fill
      const deepest = rects[FRAME_COUNT - 1];
      ctx.fillStyle = `rgba(${WALL_R}, ${WALL_G}, ${WALL_B}, ${FLOOR_ALPHA})`;
      ctx.fillRect(
        deepest.left,
        deepest.top,
        deepest.right - deepest.left,
        deepest.bottom - deepest.top,
      );

      // Edge line on deepest frame
      const deepEdgeAlpha = EDGE_LINE_ALPHA_FAR * 0.5;
      ctx.strokeStyle = `rgba(${WALL_R}, ${WALL_G}, ${WALL_B}, ${deepEdgeAlpha.toFixed(4)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(
        deepest.left,
        deepest.top,
        deepest.right - deepest.left,
        deepest.bottom - deepest.top,
      );
      ctx.stroke();

      // Vignette
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
