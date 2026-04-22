"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";

type ConsentModalProps = {
  onAgree: () => void;
  onDisagree: () => void;
};

export function ConsentModal({ onAgree, onDisagree }: ConsentModalProps) {
  const t = useTranslations("consent");
  const locale = useLocale();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 safe-top safe-bottom"
      style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-[320px] max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col animate-fade-in-up"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border-game)",
          borderRadius: "12px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10">
          <h1 className="text-[20px] font-semibold text-foreground break-keep">
            {t("heading")}
          </h1>
        </div>

        {/* Warning lines */}
        <div className="p-5 flex flex-col gap-3 text-foreground/80 text-[14px] leading-relaxed break-keep">
          {([1, 2, 3, 4, 5] as const).map((num) => (
            <div key={num} className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <p>{t(`line${num}`)}</p>
            </div>
          ))}

          <div className="mt-2">
            <Link
              href={`/${locale}/terms`}
              className="text-foreground underline decoration-border-subtle underline-offset-4 hover:decoration-accent transition-colors text-[13px]"
            >
              {t("detailsLink")}
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 flex flex-col items-center gap-3 bg-white/5 border-t border-white/10">
          <button
            onClick={onAgree}
            className="w-full max-w-[280px] h-[56px] bg-accent text-black cta-text text-[16px] rounded-[16px] active:scale-[0.97] transition-transform neon-glow"
          >
            {t("agree")}
          </button>
          <button
            onClick={onDisagree}
            className="w-full max-w-[200px] h-[44px] text-foreground/60 text-[14px] font-medium hover:text-foreground transition-colors active:scale-[0.97] rounded-[8px]"
          >
            {t("disagree")}
          </button>
        </div>
      </div>
    </div>
  );
}
