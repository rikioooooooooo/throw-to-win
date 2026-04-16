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
        className="w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto flex flex-col animate-fade-in-up"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "14px",
        }}
      >
        {/* Header */}
        <div className="p-6" style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            {t("heading")}
          </h1>
        </div>

        {/* Warning lines */}
        <div className="p-6 flex flex-col gap-4 text-muted text-[15px] leading-relaxed">
          {([1, 2, 3, 4, 5] as const).map((num) => (
            <div key={num} className="flex items-start gap-3">
              <span className="text-accent mt-0.5">&mdash;</span>
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
        <div
          className="p-6 flex flex-col gap-3"
          style={{
            backgroundColor: "var(--color-surface-elevated)",
            borderTop: "1px solid var(--color-border-subtle)",
            borderRadius: "0 0 14px 14px",
          }}
        >
          <button
            onClick={onAgree}
            className="w-full py-4 bg-accent text-white cta-text text-[16px] tracking-[0.15em] active:scale-[0.97] transition-transform duration-75"
            style={{ borderRadius: "14px" }}
          >
            {t("agree")}
          </button>
          <button
            onClick={onDisagree}
            className="w-full py-3 text-muted text-[14px] font-medium hover:text-foreground transition-colors active:scale-[0.97]"
          >
            {t("disagree")}
          </button>
        </div>
      </div>
    </div>
  );
}
