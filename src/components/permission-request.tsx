"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type PermissionRequestProps = {
  onGranted: () => void;
};

type DeniedState = "none" | "denied" | "unsupported";

export function PermissionRequest({ onGranted }: PermissionRequestProps) {
  const t = useTranslations("permissions");
  const [deniedState, setDeniedState] = useState<DeniedState>("none");
  const [requesting, setRequesting] = useState(false);

  async function handleGrant() {
    setRequesting(true);
    setDeniedState("none");

    try {
      // iOS DeviceMotionEvent permission
      if (
        typeof DeviceMotionEvent !== "undefined" &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (DeviceMotionEvent as any).requestPermission === "function"
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await (DeviceMotionEvent as any).requestPermission();
        if (result !== "granted") {
          setDeniedState("denied");
          setRequesting(false);
          return;
        }
      } else if (typeof DeviceMotionEvent === "undefined") {
        setDeniedState("unsupported");
        setRequesting(false);
        return;
      }

      // Camera permission
      if (!navigator.mediaDevices?.getUserMedia) {
        setDeniedState("unsupported");
        setRequesting(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      // Stop tracks immediately — we only need the permission grant here
      stream.getTracks().forEach((track) => track.stop());

      onGranted();
    } catch {
      setDeniedState("denied");
    } finally {
      setRequesting(false);
    }
  }

  if (deniedState === "unsupported") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 safe-top safe-bottom">
        <div className="w-full max-w-md flex flex-col gap-6 text-center animate-fade-in-up">
          <h1 className="font-display text-[28px] font-black uppercase tracking-tighter text-white">
            {t("unsupported")}
          </h1>
          <p className="text-muted text-[14px] leading-relaxed">
            {t("unsupportedDetail")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black px-6 safe-top safe-bottom">
      <div className="w-full max-w-md flex flex-col gap-10 animate-fade-in-up">
        {/* Heading + red accent line */}
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[clamp(1.8rem,8vw,2.8rem)] font-black tracking-tighter uppercase text-white">
            {t("heading")}
          </h1>
          <div className="w-12 h-1 bg-accent" />
        </div>

        {/* Requirement cards */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-border p-5 flex items-center gap-4 relative">
            <div className="absolute top-5 right-5 w-2 h-2 bg-accent rounded-full animate-pulse-red" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <p className="text-white/80 text-[14px]">{t("motionSensor")}</p>
          </div>
          <div className="bg-surface border border-border p-5 flex items-center gap-4 relative">
            <div className="absolute top-5 right-5 w-2 h-2 bg-accent rounded-full animate-pulse-red delay-100" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <p className="text-white/80 text-[14px]">{t("camera")}</p>
          </div>
        </div>

        {/* Denied error */}
        {deniedState === "denied" && (
          <div className="p-4 border border-accent bg-accent/10 text-accent text-[13px] font-medium text-center">
            {t("denied")}
          </div>
        )}

        {/* Grant button — white inverted for premium feel */}
        <button
          onClick={handleGrant}
          disabled={requesting}
          className="w-full py-5 bg-white text-black font-display text-xl font-black tracking-[0.25em] uppercase disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition-all duration-75 hover:bg-accent hover:text-white shadow-[0_0_40px_rgba(255,255,255,0.1)]"
        >
          {requesting
            ? "..."
            : deniedState === "denied"
              ? t("retryButton")
              : t("grantButton")}
        </button>
      </div>
    </div>
  );
}
