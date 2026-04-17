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

  // NON-async: iOS Safari requires DeviceMotionEvent.requestPermission()
  // to be called within the synchronous user-gesture context.
  // Using async/await can break this on iOS 16+.
  function handleGrant() {
    setRequesting(true);
    setDeniedState("none");

    // Step 1: DeviceMotionEvent permission (iOS only)
    if (typeof DeviceMotionEvent === "undefined") {
      setDeniedState("unsupported");
      setRequesting(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const needsMotionPermission = typeof (DeviceMotionEvent as any).requestPermission === "function";

    const motionPromise: Promise<string> = needsMotionPermission
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (DeviceMotionEvent as any).requestPermission()
      : Promise.resolve("granted");

    // .then() chain preserves user-gesture context on iOS Safari
    motionPromise
      .then((result: string) => {
        if (result !== "granted") {
          setDeniedState("denied");
          setRequesting(false);
          return;
        }
        // Step 2: Camera permission is handled by startPreview() in onGranted.
        // No redundant getUserMedia here — avoids double-request race on iOS.
        setRequesting(false);
        onGranted();
      })
      .catch(() => {
        setDeniedState("denied");
        setRequesting(false);
      });
  }

  if (deniedState === "unsupported") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
        <div className="w-full max-w-md flex flex-col gap-6 text-center animate-fade-in-up">
          {/* Error icon */}
          <div className="flex justify-center mb-2">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="text-[24px] font-semibold text-foreground">
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6 safe-top safe-bottom">
      <div className="w-full max-w-md flex flex-col gap-10 animate-fade-in-up">
        {/* Heading */}
        <div className="flex flex-col gap-3">
          <h1 className="text-[clamp(1.8rem,8vw,2.8rem)] font-semibold tracking-tight text-foreground">
            {t("heading")}
          </h1>
          <div className="w-12 h-1 bg-accent" style={{ borderRadius: "2px" }} />
        </div>

        {/* Requirement cards */}
        <div className="flex flex-col gap-4">
          <div
            className="p-5 flex items-center gap-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "12px",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <p className="text-white/80 text-[14px]">{t("motionSensor")}</p>
          </div>
          <div
            className="p-5 flex items-center gap-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border-subtle)",
              borderRadius: "12px",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
            <p className="text-white/80 text-[14px]">{t("camera")}</p>
          </div>
        </div>

        {/* Denied error */}
        {deniedState === "denied" && (
          <div
            className="p-4 text-error text-[13px] font-medium text-center"
            style={{
              border: "1px solid var(--color-error)",
              backgroundColor: "rgba(255, 68, 68, 0.1)",
              borderRadius: "12px",
            }}
          >
            {t("denied")}
          </div>
        )}

        {/* Grant button */}
        <button
          onClick={handleGrant}
          disabled={requesting}
          className="w-full py-5 bg-accent text-black cta-text text-[16px] tracking-[0.15em] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] transition-all duration-75"
          style={{ borderRadius: "14px" }}
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
