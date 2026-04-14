"use client";

import { useTranslations } from "next-intl";
import { downloadBlob, shareTo } from "@/lib/share";
import { ShareButtons } from "@/components/share-buttons";

type ResultCardProps = {
  heightMeters: number;
  airtimeSeconds: number;
  isPersonalBest: boolean;
  videoBlob: Blob | null;
  locale: string;
  onTryAgain: () => void;
};

export function ResultCard({
  heightMeters,
  airtimeSeconds,
  isPersonalBest,
  videoBlob,
  locale,
  onTryAgain,
}: ResultCardProps) {
  const t = useTranslations("result");

  function handleDownload() {
    if (!videoBlob) return;
    downloadBlob(videoBlob, `throw-to-win-${heightMeters.toFixed(2)}m.mp4`);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-between bg-black px-6 py-12 overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {isPersonalBest && (
          <div className="w-full text-center py-3 border border-yellow-400">
            <span className="font-display font-black text-yellow-400 text-xl tracking-widest uppercase">
              {t("newRecord")}
            </span>
          </div>
        )}

        <div className="w-full flex flex-col items-center gap-2">
          <span className="text-[#a3a3a3] text-sm uppercase tracking-widest font-medium">
            {t("height")}
          </span>
          <span
            className="font-display font-black text-[#ef4444] leading-none tabular-nums"
            style={{ fontSize: "clamp(5rem, 30vw, 10rem)" }}
          >
            {heightMeters.toFixed(2)}
            <span className="text-[0.4em] align-bottom ml-1">m</span>
          </span>
        </div>

        <div className="w-full flex flex-col items-center gap-1 border-t border-[#262626] pt-6">
          <span className="text-[#a3a3a3] text-sm uppercase tracking-widest font-medium">
            {t("airtime")}
          </span>
          <span className="font-display font-black text-white text-4xl tabular-nums">
            {airtimeSeconds.toFixed(2)}s
          </span>
        </div>

        {videoBlob ? (
          <div className="w-full flex flex-col gap-3">
            <ShareButtons
              videoBlob={videoBlob}
              heightMeters={heightMeters}
              locale={locale}
            />
            <button
              onClick={handleDownload}
              className="w-full py-3 border border-[#262626] text-white text-sm font-medium tracking-wide hover:border-white transition-colors"
            >
              {t("downloadVideo")}
            </button>
          </div>
        ) : (
          <p className="text-[#a3a3a3] text-sm">{t("noVideo")}</p>
        )}

        <button
          onClick={onTryAgain}
          className="w-full py-4 bg-[#ef4444] text-white font-display text-2xl font-black tracking-widest uppercase active:bg-[#dc2626] transition-colors"
        >
          {t("tryAgain")}
        </button>
      </div>
    </div>
  );
}
