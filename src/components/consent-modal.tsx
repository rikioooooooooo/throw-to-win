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
    <div className="fixed inset-0 z-50 flex items-center justify-center glass p-4 safe-top safe-bottom">
      <div className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-surface border border-border shadow-2xl flex flex-col animate-fade-in-up">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h1 className="font-display text-[32px] font-black tracking-tighter text-white">
            {t("heading")}
          </h1>
        </div>

        {/* Warning lines */}
        <div className="p-6 flex flex-col gap-4 text-muted text-[15px] leading-relaxed">
          {([1, 2, 3, 4, 5] as const).map((num) => (
            <div key={num} className="flex items-start gap-3">
              <span className="text-accent font-display mt-0.5">&mdash;</span>
              <p>{t(`line${num}`)}</p>
            </div>
          ))}

          <div className="mt-2">
            <Link
              href={`/${locale}/terms`}
              className="text-white underline decoration-border underline-offset-4 hover:decoration-accent transition-colors text-[13px]"
            >
              {t("detailsLink")}
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-col gap-3 bg-surface-light border-t border-border">
          <button
            onClick={onAgree}
            className="w-full py-4 bg-accent text-white font-display text-xl font-black tracking-[0.25em] uppercase active:scale-[0.97] transition-transform duration-75 shadow-[0_0_40px_rgba(255,45,45,0.25)]"
          >
            {t("agree")}
          </button>
          <button
            onClick={onDisagree}
            className="w-full py-3 text-muted text-[14px] font-medium hover:text-white transition-colors active:scale-[0.97]"
          >
            {t("disagree")}
          </button>
        </div>
      </div>
    </div>
  );
}
