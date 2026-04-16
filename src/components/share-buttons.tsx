"use client";

import { useTranslations } from "next-intl";
import { shareTo } from "@/lib/share";

type ShareButtonsProps = {
  videoBlob: Blob;
  heightMeters: number;
  locale: string;
};

type Platform = {
  id: "tiktok" | "x" | "instagram";
  label: string;
};

const PLATFORMS: Platform[] = [
  { id: "tiktok", label: "TikTok" },
  { id: "x", label: "X" },
  { id: "instagram", label: "Instagram" },
];

export function ShareButtons({ videoBlob, heightMeters, locale }: ShareButtonsProps) {
  const t = useTranslations("result");

  return (
    <div className="w-full flex gap-2">
      {PLATFORMS.map((platform) => (
        <button
          key={platform.id}
          onClick={() => shareTo(platform.id, videoBlob, heightMeters, locale)}
          className="flex-1 py-4 text-foreground text-[13px] font-medium tracking-wide uppercase active:scale-[0.97] transition-all duration-75 hover:bg-surface-elevated"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
          aria-label={`${t("shareOn")} ${platform.label}`}
        >
          {platform.label}
        </button>
      ))}
    </div>
  );
}
