"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

export type CountdownStep = 3 | 2 | 1 | "throw" | "done";

type CountdownProps = {
  onComplete: () => void;
  /** Reports each step for video overlay baking */
  onTick?: (step: CountdownStep) => void;
};

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

  useEffect(() => {
    const steps: CountdownStep[] = [3, 2, 1, "throw", "done"];
    let index = 0;

    function advance() {
      index += 1;
      const next = steps[index];
      if (next === undefined) return;

      setStep(next);

      if (next === "done") {
        timerRef.current = setTimeout(onComplete, 400);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-light safe-top safe-bottom pointer-events-none">
      {step === "throw" ? (
        <span
          key="throw"
          className="animate-countdown font-display font-black text-[clamp(4rem,18vw,7rem)] tracking-tighter uppercase text-accent text-glow leading-none"
        >
          {t("throwNow")}
        </span>
      ) : (
        <span
          key={step}
          className="animate-countdown hud-number text-white text-camera leading-none"
          style={{ fontSize: "clamp(10rem,50vw,18rem)" }}
        >
          {step}
        </span>
      )}
    </div>
  );
}
