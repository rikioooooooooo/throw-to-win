"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Gyroscope parallax box: the phone screen is the lid of a rectangular box.
 * Tilting reveals the walls (trapezoids) and floor (shifted rectangle).
 * 4 perspective edge lines define the box shape clearly.
 * Poles stand on the floor as depth markers.
 */

type GyroBarsProps = {
  readonly className?: string;
};

type Pole = {
  readonly wx: number;
  readonly wy: number;
  readonly z: number;
};

const GRID_COLS = 12;
const GRID_ROWS = 20;
const DEPTH_LAYERS = 6;
const POLE_SHIFT = 120;
const GYRO_TIMEOUT_MS = 2000;
const GRID_RANGE = 1.5;

/** Box geometry */
const BOX_INSET = 50;    // floor inset from screen edges (box depth in perspective px)
const BOX_FLOOR_SHIFT = 100; // how far floor moves with full tilt

function createPoles(): readonly Pole[] {
  const poles: Pole[] = [];
  for (let d = 0; d < DEPTH_LAYERS; d++) {
    const z = (d + 1) / DEPTH_LAYERS;
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        poles.push({
          wx: (col / (GRID_COLS - 1)) * 2 * GRID_RANGE - GRID_RANGE,
          wy: (row / (GRID_ROWS - 1)) * 2 * GRID_RANGE - GRID_RANGE,
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
  const calibratedRef = useRef(false);
  const betaOffsetRef = useRef(0);
  const rafRef = useRef(0);
  const polesRef = useRef<readonly Pole[]>(createPoles());

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
    };
    resize();
    window.addEventListener("resize", resize);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const startTime = performance.now();
    const poles = polesRef.current;
    const AC = "0, 250, 154"; // accent color RGB

    const draw = (now: number) => {
      const cw = window.innerWidth;
      const ch = window.innerHeight;
      if (cw === 0 || ch === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      if (useFallback && !hasGyroRef.current) {
        const t = (now - startTime) / 1000;
        targetRef.current = {
          x: Math.sin(t * 0.35) * 0.25,
          y: Math.cos(t * 0.5) * 0.12,
        };
      }

      currentRef.current = { ...targetRef.current };
      const tiltX = currentRef.current.x;
      const tiltY = currentRef.current.y;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);

      // --- Box geometry ---
      // Screen corners (lid opening)
      const sTL = { x: 0, y: 0 };
      const sTR = { x: cw, y: 0 };
      const sBL = { x: 0, y: ch };
      const sBR = { x: cw, y: ch };

      // Floor corners (bottom of box) — inset + shift with tilt
      const shiftX = tiltX * BOX_FLOOR_SHIFT;
      const shiftY = tiltY * BOX_FLOOR_SHIFT;
      const fTL = { x: BOX_INSET + shiftX, y: BOX_INSET + shiftY };
      const fTR = { x: cw - BOX_INSET + shiftX, y: BOX_INSET + shiftY };
      const fBL = { x: BOX_INSET + shiftX, y: ch - BOX_INSET + shiftY };
      const fBR = { x: cw - BOX_INSET + shiftX, y: ch - BOX_INSET + shiftY };

      // --- 1. Floor ---
      ctx.beginPath();
      ctx.moveTo(fTL.x, fTL.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fBL.x, fBL.y);
      ctx.closePath();
      ctx.fillStyle = `rgba(${AC}, 0.06)`;
      ctx.fill();

      // Floor grid lines
      ctx.strokeStyle = `rgba(${AC}, 0.10)`;
      ctx.lineWidth = 0.5;
      const floorW = fTR.x - fTL.x;
      const floorH = fBL.y - fTL.y;
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        // Vertical lines on floor
        ctx.beginPath();
        ctx.moveTo(fTL.x + floorW * t, fTL.y);
        ctx.lineTo(fBL.x + floorW * t, fBL.y);
        ctx.stroke();
        // Horizontal lines on floor
        if (i < 12) {
          const ht = i / 12;
          ctx.beginPath();
          ctx.moveTo(fTL.x, fTL.y + floorH * ht);
          ctx.lineTo(fTR.x, fTR.y + floorH * ht);
          ctx.stroke();
        }
      }

      // --- 2. Walls (trapezoids from screen edge to floor edge) ---
      // Left wall
      const leftWallAlpha = Math.max(0, Math.min(0.20, tiltX * 0.15));
      if (leftWallAlpha > 0.003) {
        ctx.beginPath();
        ctx.moveTo(sTL.x, sTL.y);
        ctx.lineTo(fTL.x, fTL.y);
        ctx.lineTo(fBL.x, fBL.y);
        ctx.lineTo(sBL.x, sBL.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${AC}, ${leftWallAlpha.toFixed(3)})`;
        ctx.fill();
      }

      // Right wall
      const rightWallAlpha = Math.max(0, Math.min(0.20, -tiltX * 0.15));
      if (rightWallAlpha > 0.003) {
        ctx.beginPath();
        ctx.moveTo(sTR.x, sTR.y);
        ctx.lineTo(fTR.x, fTR.y);
        ctx.lineTo(fBR.x, fBR.y);
        ctx.lineTo(sBR.x, sBR.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${AC}, ${rightWallAlpha.toFixed(3)})`;
        ctx.fill();
      }

      // Top wall
      const topWallAlpha = Math.max(0, Math.min(0.20, tiltY * 0.15));
      if (topWallAlpha > 0.003) {
        ctx.beginPath();
        ctx.moveTo(sTL.x, sTL.y);
        ctx.lineTo(fTL.x, fTL.y);
        ctx.lineTo(fTR.x, fTR.y);
        ctx.lineTo(sTR.x, sTR.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${AC}, ${topWallAlpha.toFixed(3)})`;
        ctx.fill();
      }

      // Bottom wall
      const bottomWallAlpha = Math.max(0, Math.min(0.20, -tiltY * 0.15));
      if (bottomWallAlpha > 0.003) {
        ctx.beginPath();
        ctx.moveTo(sBL.x, sBL.y);
        ctx.lineTo(fBL.x, fBL.y);
        ctx.lineTo(fBR.x, fBR.y);
        ctx.lineTo(sBR.x, sBR.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${AC}, ${bottomWallAlpha.toFixed(3)})`;
        ctx.fill();
      }

      // --- 3. Poles (stand on the floor) ---
      const cx = cw / 2;
      const cy = ch / 2;
      const spreadX = cw * 0.6;
      const spreadY = ch * 0.6;

      for (const pole of poles) {
        const convergence = 0.15 + (1 - pole.z) * 0.85;
        const perspectiveScale = 1 / (0.2 + pole.z * 0.8);
        const parallaxFactor = (1 - pole.z) * POLE_SHIFT;

        const sx = cx + pole.wx * spreadX * convergence + tiltX * parallaxFactor;
        const sy = cy + pole.wy * spreadY * convergence + tiltY * parallaxFactor;

        const radius = 4.0 * perspectiveScale;
        const depthFog = Math.pow(1 - pole.z, 1.5);
        const alpha = 0.03 + depthFog * 0.38;

        if (sx < -radius || sx > cw + radius || sy < -radius || sy > ch + radius) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${AC}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }

      // --- 4. Edge lines (box corners — on top of everything) ---
      ctx.strokeStyle = `rgba(${AC}, 0.30)`;
      ctx.lineWidth = 1.5;

      // TL corner
      ctx.beginPath(); ctx.moveTo(sTL.x, sTL.y); ctx.lineTo(fTL.x, fTL.y); ctx.stroke();
      // TR corner
      ctx.beginPath(); ctx.moveTo(sTR.x, sTR.y); ctx.lineTo(fTR.x, fTR.y); ctx.stroke();
      // BL corner
      ctx.beginPath(); ctx.moveTo(sBL.x, sBL.y); ctx.lineTo(fBL.x, fBL.y); ctx.stroke();
      // BR corner
      ctx.beginPath(); ctx.moveTo(sBR.x, sBR.y); ctx.lineTo(fBR.x, fBR.y); ctx.stroke();

      // Floor border
      ctx.strokeStyle = `rgba(${AC}, 0.18)`;
      ctx.beginPath();
      ctx.moveTo(fTL.x, fTL.y);
      ctx.lineTo(fTR.x, fTR.y);
      ctx.lineTo(fBR.x, fBR.y);
      ctx.lineTo(fBL.x, fBL.y);
      ctx.closePath();
      ctx.stroke();

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
