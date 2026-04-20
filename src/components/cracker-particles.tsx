"use client";

import { useEffect, useRef } from "react";
import type { CrackerLevel } from "@/lib/achievements";

// ---- Particle config per level ----
const LEVEL_CONFIG: Record<
  Exclude<CrackerLevel, "none">,
  {
    readonly count: number;
    readonly spread: number;
    readonly gravity: number;
    readonly colors: readonly string[];
    readonly duration: number;
  }
> = {
  legendary: {
    count: 120,
    spread: 1.0,
    gravity: 0.0008,
    colors: [
      "#FFD700",
      "#FFA500",
      "#FF4500",
      "#FF2D2D",
      "#FFFFFF",
      "#FFE066",
    ],
    duration: 4000,
  },
  epic: {
    count: 80,
    spread: 0.8,
    gravity: 0.001,
    colors: [
      "#9B59B6",
      "#3498DB",
      "#00E5FF",
      "#FFD700",
      "#FF69B4",
      "#FFFFFF",
    ],
    duration: 3000,
  },
  rare: {
    count: 50,
    spread: 0.6,
    gravity: 0.0012,
    colors: [
      "#00FA9A",
      "#00E5FF",
      "#FFFFFF",
      "#50C878",
    ],
    duration: 2500,
  },
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  shape: "rect" | "circle" | "star";
  born: number;
  life: number;
};

function createParticle(
  cx: number,
  cy: number,
  config: (typeof LEVEL_CONFIG)[keyof typeof LEVEL_CONFIG],
  now: number,
): Particle {
  const angle = Math.random() * Math.PI * 2;
  const speed = (0.5 + Math.random() * 3.5) * config.spread;
  const shapes: Particle["shape"][] = ["rect", "circle", "star"];
  return {
    x: cx,
    y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - (1 + Math.random() * 2),
    color: config.colors[Math.floor(Math.random() * config.colors.length)],
    size: 3 + Math.random() * 6,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.15,
    opacity: 1,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    born: now,
    life: config.duration * (0.6 + Math.random() * 0.4),
  };
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
) {
  const spikes = 5;
  const outerR = size;
  const innerR = size * 0.4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

type CrackerParticlesProps = {
  readonly level: CrackerLevel;
  readonly active: boolean;
};

export function CrackerParticles({ level, active }: CrackerParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const burstDoneRef = useRef(false);

  useEffect(() => {
    if (level === "none" || !active) {
      burstDoneRef.current = false;
      particlesRef.current = [];
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config = LEVEL_CONFIG[level];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Initial burst
    if (!burstDoneRef.current) {
      burstDoneRef.current = true;
      const now = performance.now();
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.3;
      const particles: Particle[] = [];
      for (let i = 0; i < config.count; i++) {
        particles.push(createParticle(cx, cy, config, now));
      }
      // Side bursts for legendary
      if (level === "legendary") {
        for (let i = 0; i < 30; i++) {
          particles.push(
            createParticle(window.innerWidth * 0.15, cy, config, now),
          );
          particles.push(
            createParticle(window.innerWidth * 0.85, cy, config, now),
          );
        }
      }
      particlesRef.current = particles;
    }

    let running = true;

    const tick = () => {
      if (!running) return;

      const now = performance.now();
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      const alive: Particle[] = [];

      for (const p of particlesRef.current) {
        const age = now - p.born;
        if (age > p.life) continue;

        p.vy += config.gravity * 16;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const progress = age / p.life;
        p.opacity = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        switch (p.shape) {
          case "rect":
            ctx.fillRect(
              -p.size / 2,
              -p.size * 0.3,
              p.size,
              p.size * 0.6,
            );
            break;
          case "circle":
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "star":
            drawStar(ctx, 0, 0, p.size / 2);
            break;
        }
        ctx.restore();

        alive.push(p);
      }

      particlesRef.current = alive;

      if (alive.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [level, active]);

  if (level === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    />
  );
}
