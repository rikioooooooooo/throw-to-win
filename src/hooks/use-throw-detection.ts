"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ThrowDetector } from "@/lib/sensor";
import type { AccelSample, ThrowPhase, ThrowResult } from "@/lib/types";

type UseThrowDetectionReturn = {
  phase: ThrowPhase;
  result: ThrowResult | null;
  isCalibrated: boolean;
  realtimeHeight: number;
  getFreefallStartTime: () => number;
  getEstimatedV0: () => number;
  getSamples: () => readonly AccelSample[];
  startCalibration: () => void;
  startDetection: () => void;
  reset: () => void;
};

export function useThrowDetection(): UseThrowDetectionReturn {
  const [phase, setPhase] = useState<ThrowPhase>("idle");
  const [result, setResult] = useState<ThrowResult | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [realtimeHeight, setRealtimeHeight] = useState(0);

  const detectorRef = useRef<ThrowDetector | null>(null);
  const rafRef = useRef<number>(0);
  const calibratedRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const tickFn = useCallback(() => {
    const detector = detectorRef.current;
    if (!detector) return;

    detector.tick();

    if (!calibratedRef.current && detector.isCalibrated()) {
      calibratedRef.current = true;
      setIsCalibrated(true);
    }

    if (detector.getPhase() === "freefall") {
      setRealtimeHeight(detector.getRealtimeHeight());
    }

    const currentPhase = detector.getPhase();
    if (
      currentPhase === "calibrating" ||
      currentPhase === "waiting-throw" ||
      currentPhase === "launched" ||
      currentPhase === "freefall"
    ) {
      rafRef.current = requestAnimationFrame(tickRef.current);
    }
  }, []);

  useEffect(() => {
    tickRef.current = tickFn;
  }, [tickFn]);

  const startCalibration = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    detectorRef.current?.stop();

    const detector = new ThrowDetector((newPhase, throwResult) => {
      setPhase(newPhase);
      if (throwResult) {
        setResult(throwResult);
        setRealtimeHeight(throwResult.heightMeters);
      }
    });
    detectorRef.current = detector;
    detector.startCalibration();
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const startDetection = useCallback(() => {
    const detector = detectorRef.current;
    if (!detector) return;
    detector.startWaitingForThrow();
    rafRef.current = requestAnimationFrame(tickRef.current);
  }, []);

  const getFreefallStartTime = useCallback(() => {
    return detectorRef.current?.getFreefallStartTime() ?? 0;
  }, []);

  const getEstimatedV0 = useCallback(() => {
    return detectorRef.current?.getEstimatedV0() ?? 0;
  }, []);

  const getSamples = useCallback(() => {
    return detectorRef.current?.getSamples() ?? [];
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    detectorRef.current?.reset();
    detectorRef.current = null;
    calibratedRef.current = false;
    setPhase("idle");
    setResult(null);
    setIsCalibrated(false);
    setRealtimeHeight(0);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      detectorRef.current?.stop();
    };
  }, []);

  return {
    phase,
    result,
    isCalibrated,
    realtimeHeight,
    getFreefallStartTime,
    getEstimatedV0,
    getSamples,
    startCalibration,
    startDetection,
    reset,
  };
}
