"use client";

import { useEffect, useRef } from "react";

type SlowMoPlayerProps = {
  src: string;
  /** Seconds from video start where slow-mo begins */
  slowStart: number;
  /** Seconds from video start where slow-mo ends */
  slowEnd: number;
  /** Playback rate during slow-mo section (default: 0.25) */
  slowRate?: number;
  className?: string;
};

/**
 * Video player with automatic slow-motion around the peak.
 * Uses requestAnimationFrame for smooth playbackRate transitions.
 */
export function SlowMoPlayer({
  src,
  slowStart,
  slowEnd,
  slowRate = 0.25,
  className,
}: SlowMoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (slowStart >= slowEnd) return;

    let rafId: number;

    const update = () => {
      if (!video.paused && !video.ended) {
        const t = video.currentTime;
        const inSlowZone = t >= slowStart && t <= slowEnd;
        const targetRate = inSlowZone ? slowRate : 1.0;

        if (Math.abs(video.playbackRate - targetRate) > 0.01) {
          video.playbackRate = targetRate;
        }
      }
      rafId = requestAnimationFrame(update);
    };

    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [src, slowStart, slowEnd, slowRate]);

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      autoPlay
      muted
      loop
      className={`bg-black object-cover ${className ?? ""}`}
    />
  );
}
