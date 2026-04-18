"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { GyroBars } from "@/components/gyro-ball";

const SnowGlobe = dynamic(
  () =>
    import("@/components/snow-globe/snow-globe").then((m) => ({
      default: m.SnowGlobe,
    })),
  { ssr: false },
);

type SnowGlobeTier = "full" | "no-bloom" | "2d-fallback";

function detectTier(): SnowGlobeTier {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return "2d-fallback";
  }
  try {
    const c = document.createElement("canvas");
    if (!c.getContext("webgl2") && !c.getContext("webgl")) {
      return "2d-fallback";
    }
  } catch {
    return "2d-fallback";
  }
  const cores = navigator.hardwareConcurrency ?? 2;
  if (cores < 4) return "2d-fallback";
  if (cores >= 6) return "full";
  return "no-bloom";
}

interface LandingBackgroundProps {
  readonly className?: string;
}

export function LandingBackground({ className }: LandingBackgroundProps) {
  const [tier, setTier] = useState<SnowGlobeTier>("2d-fallback");
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setTier(detectTier());
  }, []);

  if (tier === "2d-fallback" || fallback) {
    return <GyroBars className={className} />;
  }

  return (
    <SnowGlobe
      className={className}
      enableBloom={tier === "full"}
      onInitFail={() => setFallback(true)}
    />
  );
}
