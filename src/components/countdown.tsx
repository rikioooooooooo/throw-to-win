"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type CountdownStep = 3 | 2 | 1 | "throw" | "done";

type CountdownProps = {
  onComplete: () => void;
  /** Reports each step for video overlay baking */
  onTick?: (step: CountdownStep) => void;
};

/**
 * Countdown with clean fade transitions:
 * - Smooth fade between numbers (ease-out 0.2s)
 * - Semi-transparent overlay
 * - "THROW" text in accent color
 * - Subtle haptic tick on each number
 */
export function Countdown({ onComplete, onTick }: CountdownProps) {
  const t = useTranslations("game");
  const [step, setStep] = useState<CountdownStep>(3);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Report step changes to parent (for canvas overlay)
  useEffect(() => {
    if (step !== "done") {
      onTick?.(step);
    }
  }, [step, onTick]);

  // Haptic tick on each step
  useEffect(() => {
    if (step === "done") return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, [step]);

  useEffect(() => {
    const steps: CountdownStep[] = [3, 2, 1, "throw", "done"];
    let index = 0;

    function advance() {
      index += 1;
      const next = steps[index];
      if (next === undefined) return;

      setStep(next);

      if (next === "done") {
        timerRef.current = setTimeout(onComplete, 200);
        return;
      }

      timerRef.current = setTimeout(advance, 1000);
    }

    timerRef.current = setTimeout(advance, 1000);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [onComplete]);

  if (step === "done") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center safe-top safe-bottom pointer-events-none"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
    >
      {step === "throw" ? (
        <span
          key="throw"
          className="cta-text text-[clamp(4rem,18vw,7rem)] tracking-wide text-accent leading-none text-camera"
          style={{
            animation: "countdown-fade 0.2s ease-out both",
          }}
        >
          {t("throwNow")}
        </span>
      ) : (
        <span
          key={step}
          className="height-number text-white text-camera leading-none"
          style={{
            fontSize: "clamp(10rem,50vw,18rem)",
            animation: "countdown-fade 0.2s ease-out both",
          }}
        >
          {step}
        </span>
      )}
    </div>
  );
}
