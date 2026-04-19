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

  // iOS Safari: requestPermission() MUST be the very first API call
  // inside the click handler — no setState, no conditionals before it.
  // Any JavaScript that touches React state or runs microtasks before
  // requestPermission() can break the user-gesture context on iOS 16+.
  function handleGrant() {
    if (typeof DeviceMotionEvent === "undefined") {
      setDeniedState("unsupported");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rp = (DeviceMotionEvent as any).requestPermission;
    if (typeof rp === "function") {
      // iOS: call requestPermission() IMMEDIATELY — no setState before this line.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (rp as () => Promise<string>)()
        .then((result: string) => {
          if (result === "granted") {
            onGranted();
          } else {
            setDeniedState("denied");
          }
        })
        .catch(() => {
          setDeniedState("denied");
        });
      return;
    }

    // Android / desktop: DeviceMotionEvent exists but no requestPermission.
    // Proceed directly — camera permission is handled by startPreview().
    onGranted();
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
        {/* Asset placeholder */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 border border-dashed border-accent/20 rounded-lg flex items-center justify-center text-accent/30 text-[10px] text-center">
            （仮）<br/>許可アセット
          </div>
        </div>

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
