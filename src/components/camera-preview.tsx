"use client";

import type React from "react";

type CameraPreviewProps = {
  videoRef: React.Ref<HTMLVideoElement>;
  isRecording: boolean;
};

export function CameraPreview({ videoRef, isRecording }: CameraPreviewProps) {
  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Recording indicator — top left, minimal */}
      {isRecording && (
        <div className="absolute top-4 left-4 safe-top z-20 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-rec" />
          <span className="text-white/30 text-[10px] font-bold tracking-[0.15em] uppercase">
            REC
          </span>
        </div>
      )}
    </div>
  );
}
