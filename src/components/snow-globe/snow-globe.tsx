"use client";

import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import {
  KOSUKUMA_OUTLINE_PATHS,
  KOSUKUMA_VIEWBOX_W,
  KOSUKUMA_VIEWBOX_H,
} from "./kosukuma-paths";

// Postprocessing imports are lazy-loaded only when bloom is enabled
type PostprocessingModules = typeof import("postprocessing");

interface SnowGlobeProps {
  readonly className?: string;
  readonly enableBloom?: boolean;
  readonly onInitFail?: () => void;
}

const GYRO_TIMEOUT_MS = 2000;
const SHAKE_COOLDOWN_MS = 300;
const SHAKE_THRESHOLD = 12;
const WALL_Z = 0.15;
const WALL_Z_HALF_THICK = 0.03;
const AUTO_IMPULSE_DELAY_MS = 1500;
const AUTO_IMPULSE_STRENGTH = 0.6;
const DAMPING = 0.92;
const BROWNIAN = 0.006;
const GRAVITY_SCALE = 9.81 * 0.8;
const RESTITUTION = 0.3;

interface SilhouetteData {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  imageData: Uint8ClampedArray;
  imageW: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  bbMinX: number;
  bbMinY: number;
  bbMaxX: number;
  bbMaxY: number;
}

function buildSilhouetteCanvas(
  boxW: number,
  boxH: number,
): SilhouetteData {
  // Scale SVG to fit 60% of box height, centered
  const targetH = boxH * 0.6;
  const scale = targetH / KOSUKUMA_VIEWBOX_H;
  const scaledW = KOSUKUMA_VIEWBOX_W * scale;
  const scaledH = KOSUKUMA_VIEWBOX_H * scale;
  const offsetX = (boxW - scaledW) / 2;
  const offsetY = (boxH - scaledH) / 2;

  const canvasW = Math.ceil(boxW);
  const canvasH = Math.ceil(boxH);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(canvasW, canvasH)
      : document.createElement("canvas");
  if ("width" in canvas) {
    canvas.width = canvasW;
    canvas.height = canvasH;
  }

  const ctx = canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) {
    return { canvas, imageData: new Uint8ClampedArray(0), imageW: canvasW, scale, offsetX, offsetY, bbMinX: 0, bbMinY: 0, bbMaxX: 0, bbMaxY: 0 };
  }

  // Draw filled silhouette for pixel-based hit testing
  ctx.fillStyle = "#000";
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  for (const d of KOSUKUMA_OUTLINE_PATHS) {
    const p = new Path2D(d);
    ctx.fill(p);
  }
  ctx.restore();

  // Compute bounding box in normalized coords [-boxW/2..boxW/2, -boxH/2..boxH/2]
  const bbMinX = offsetX - boxW / 2;
  const bbMinY = offsetY - boxH / 2;
  const bbMaxX = offsetX + scaledW - boxW / 2;
  const bbMaxY = offsetY + scaledH - boxH / 2;

  const fullImageData = ctx.getImageData(0, 0, canvasW, canvasH);

  return { canvas, imageData: fullImageData.data, imageW: canvasW, scale, offsetX, offsetY, bbMinX, bbMinY, bbMaxX, bbMaxY };
}

function isInsideSilhouette(
  imageData: Uint8ClampedArray,
  imageW: number,
  px: number,
  py: number,
  boxW: number,
  boxH: number,
): boolean {
  // Convert from centered coords to canvas pixel coords
  const cx = px + boxW / 2;
  const cy = py + boxH / 2;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  if (ix < 0 || iy < 0 || ix >= Math.ceil(boxW) || iy >= Math.ceil(boxH)) return false;

  // Direct array lookup — no getImageData per call
  const alpha = imageData[(iy * imageW + ix) * 4 + 3];
  return alpha > 128;
}

export function SnowGlobe({ className, enableBloom = false, onInitFail }: SnowGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // --- Renderer ---
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onInitFail?.();
      return;
    }

    renderer.setClearColor(0x000000, 0);

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(screenW, screenH);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    container.appendChild(renderer.domElement);

    // --- Scene + Camera ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, screenW / screenH, 0.1, 100);
    camera.position.set(0, 0, 2.5);

    // --- Box dimensions ---
    const halfW = 1.0;
    const halfH = (screenH / screenW) * 1.0;
    const halfD = 0.6;

    // --- Particles ---
    const COUNT = enableBloom ? 8000 : 5000;
    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);
    const sizes = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * halfW * 2;       // X: full spread
      positions[i * 3 + 1] = -halfH + Math.random() * 0.1; // Y: settled at very bottom (off-screen)
      positions[i * 3 + 2] = (Math.random() - 0.5) * halfD * 2;   // Z: full spread
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = 0;
      velocities[i * 3 + 2] = 0;

      const r = Math.random();
      if (r < 0.7) {
        sizes[i] = 1.5 + Math.random() * 1.0; // small: 1.5-2.5
      } else if (r < 0.9) {
        sizes[i] = 3.0 + Math.random() * 1.0; // medium: 3-4
      } else {
        sizes[i] = 4.0 + Math.random() * 2.0; // large: 4-6
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      color: 0x00fa9a,
      size: 0.015,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // --- Silhouette collision data ---
    // Map box coords to pixel coords: boxW = halfW*2 world units -> pixel space
    const silPixelW = 512;
    const silPixelH = silPixelW * (halfH / halfW);
    const silData = buildSilhouetteCanvas(silPixelW, silPixelH);
    const worldToPixelX = silPixelW / (halfW * 2);
    const worldToPixelY = silPixelH / (halfH * 2);

    // --- Bloom (optional) ---
    let composer: InstanceType<PostprocessingModules["EffectComposer"]> | null = null;
    let bloomSetupDone = false;

    const setupBloom = async () => {
      if (!enableBloom || disposed) return;
      try {
        const pp = await import("postprocessing");
        if (disposed) return;
        const effectComposer = new pp.EffectComposer(renderer);
        effectComposer.addPass(new pp.RenderPass(scene, camera));
        const bloom = new pp.BloomEffect({
          luminanceThreshold: 0.1,
          intensity: 1.0,
          radius: 0.5,
          levels: 5,
          mipmapBlur: true,
        });
        bloom.resolution.scale = 0.5;
        effectComposer.addPass(new pp.EffectPass(camera, bloom));
        composer = effectComposer;
        bloomSetupDone = true;
      } catch {
        // Bloom failed — continue without it
      }
    };
    setupBloom();

    // --- Gyroscope ---
    let gravityX = 0;
    let gravityY = -GRAVITY_SCALE;
    let hasGyro = false;
    let calibrated = false;
    let betaOffset = 0;
    let useFallback = false;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      hasGyro = true;
      if (!calibrated) {
        calibrated = true;
        betaOffset = e.beta;
      }
      const gammaRad = (e.gamma * Math.PI) / 180;
      const betaAdj = e.beta - betaOffset;
      const betaRad = (betaAdj * Math.PI) / 180;
      gravityX = -Math.sin(gammaRad) * GRAVITY_SCALE;
      gravityY = -Math.cos(betaRad) * GRAVITY_SCALE;
    };
    window.addEventListener("deviceorientation", handleOrientation);

    const gyroTimer = window.setTimeout(() => {
      if (!hasGyro) useFallback = true;
    }, GYRO_TIMEOUT_MS);

    // --- Shake detection ---
    let lastShakeTime = 0;

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.acceleration;
      if (!acc || acc.x == null || acc.y == null || acc.z == null) return;
      const mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
      if (mag < SHAKE_THRESHOLD) return;
      const now = performance.now();
      if (now - lastShakeTime < SHAKE_COOLDOWN_MS) return;
      lastShakeTime = now;

      const strength = Math.min(mag / 25, 1.0) * 3.0;
      // Impulse direction: reverse of acceleration with random spread
      const nx = -acc.x / mag;
      const ny = -acc.y / mag;
      const spreadRad = (15 * Math.PI) / 180;

      for (let i = 0; i < COUNT; i++) {
        const angle = (Math.random() - 0.5) * 2 * spreadRad;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        velocities[i * 3] += (nx * cos - ny * sin) * strength;
        velocities[i * 3 + 1] += (nx * sin + ny * cos) * strength;
        velocities[i * 3 + 2] += (Math.random() - 0.5) * strength * 0.3;
      }
    };
    window.addEventListener("devicemotion", handleMotion);

    // --- Auto-impulse ---
    const autoImpulseTimer = window.setTimeout(() => {
      if (disposed) return;
      const strength = AUTO_IMPULSE_STRENGTH * 3.0;
      for (let i = 0; i < COUNT; i++) {
        velocities[i * 3] += (Math.random() - 0.5) * strength * 0.3;
        velocities[i * 3 + 1] += strength * (0.7 + Math.random() * 0.3);
        velocities[i * 3 + 2] += (Math.random() - 0.5) * strength * 0.2;
      }
    }, AUTO_IMPULSE_DELAY_MS);

    // --- Animation loop ---
    let rafId = 0;
    let lastTime = performance.now();
    let paused = false;
    const startTime = performance.now();

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;

    const animate = (now: number) => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      if (paused) return;

      const frameDelta = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(frameDelta, 0.033);

      // Fallback drift when no gyro
      if (useFallback && !hasGyro) {
        const t = (now - startTime) / 1000;
        gravityX = Math.sin(t * 0.35) * 2.0;
        gravityY = -Math.cos(t * 0.5) * 4.0;
      }

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;

        // Brownian + gravity
        velocities[i3] += gravityX * dt + (Math.random() - 0.5) * BROWNIAN;
        velocities[i3 + 1] += gravityY * dt + (Math.random() - 0.5) * BROWNIAN;
        velocities[i3 + 2] += (Math.random() - 0.5) * BROWNIAN;

        // Damping
        velocities[i3] *= DAMPING;
        velocities[i3 + 1] *= DAMPING;
        velocities[i3 + 2] *= DAMPING;

        // Integrate
        positions[i3] += velocities[i3] * dt;
        positions[i3 + 1] += velocities[i3 + 1] * dt;
        positions[i3 + 2] += velocities[i3 + 2] * dt;

        // Wall bounce X
        if (positions[i3] > halfW) {
          positions[i3] = halfW;
          velocities[i3] *= -RESTITUTION;
        } else if (positions[i3] < -halfW) {
          positions[i3] = -halfW;
          velocities[i3] *= -RESTITUTION;
        }

        // Wall bounce Y
        if (positions[i3 + 1] > halfH) {
          positions[i3 + 1] = halfH;
          velocities[i3 + 1] *= -RESTITUTION;
        } else if (positions[i3 + 1] < -halfH) {
          positions[i3 + 1] = -halfH;
          velocities[i3 + 1] *= -RESTITUTION;
        }

        // Wall bounce Z
        if (positions[i3 + 2] > halfD) {
          positions[i3 + 2] = halfD;
          velocities[i3 + 2] *= -RESTITUTION;
        } else if (positions[i3 + 2] < -halfD) {
          positions[i3 + 2] = -halfD;
          velocities[i3 + 2] *= -RESTITUTION;
        }

        // Kosukuma silhouette collision
        const pz = positions[i3 + 2];
        if (Math.abs(pz - WALL_Z) < WALL_Z_HALF_THICK) {
          const px = positions[i3];
          const py = positions[i3 + 1];
          // Check bounding box first (in pixel coords)
          const pixX = px * worldToPixelX;
          const pixY = -py * worldToPixelY; // flip Y for canvas
          if (
            pixX >= silData.bbMinX &&
            pixX <= silData.bbMaxX &&
            pixY >= silData.bbMinY &&
            pixY <= silData.bbMaxY
          ) {
            if (isInsideSilhouette(silData.imageData, silData.imageW, pixX, pixY, silPixelW, silPixelH)) {
              // Bounce Z
              velocities[i3 + 2] *= -RESTITUTION;
              positions[i3 + 2] = pz < WALL_Z ? WALL_Z - WALL_Z_HALF_THICK : WALL_Z + WALL_Z_HALF_THICK;
            }
          }
        }
      }

      posAttr.needsUpdate = true;

      if (bloomSetupDone && composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    rafId = requestAnimationFrame(animate);

    // --- Resize ---
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
      }
    };
    window.addEventListener("resize", handleResize);

    // --- Visibility ---
    const handleVisibility = () => {
      if (document.hidden) {
        paused = true;
      } else {
        paused = false;
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // --- Cleanup ---
    const cleanup = () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(gyroTimer);
      clearTimeout(autoImpulseTimer);
      window.removeEventListener("deviceorientation", handleOrientation);
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);

      scene.remove(points);
      geometry.dispose();
      material.dispose();

      if (composer) {
        composer.dispose();
      }

      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }

      if (process.env.NODE_ENV === "development") {
        console.log("SnowGlobe: cleanup complete");
      }
    };

    cleanupRef.current = cleanup;

    return cleanup;
  }, [enableBloom, onInitFail]);

  return (
    <div
      ref={setContainerRef}
      className={className}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
    />
  );
}

export default SnowGlobe;
