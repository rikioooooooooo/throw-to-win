"use client";

import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";

const SECTIONS = [
  "deviceDamage",
  "personalInjury",
  "propertyDamage",
  "thirdParty",
  "accuracy",
  "dataLoss",
] as const;

export default function TermsPage() {
  const t = useTranslations("terms");
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) ?? "en";

  return (
    <main className="flex-1 flex flex-col min-h-screen safe-top safe-bottom">
      {/* Sticky header */}
      <header
        className="px-5 py-5 flex items-center justify-between sticky top-0 z-10"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <button
          onClick={() => router.push(`/${locale}`)}
          className="w-11 h-11 flex items-center justify-center active:scale-[0.97] transition-transform"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: "10px",
          }}
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[18px] font-semibold tracking-wide uppercase">
          {t("heading")}
        </h1>
        <div className="w-11" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="max-w-2xl mx-auto space-y-10 animate-fade-in-up">
          {/* Last updated intro */}
          <div
            className="pl-4"
            style={{ borderLeft: "2px solid var(--color-accent)" }}
          >
            <p className="label-text text-[12px] tracking-widest text-accent mb-1">
              {t("lastUpdated")}
            </p>
            <p className="text-muted text-[13px]">2024-01-01</p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTIONS.map((key) => (
              <section
                key={key}
                className="p-6"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                  borderRadius: "14px",
                }}
              >
                <h2 className="text-[16px] font-semibold tracking-wide uppercase text-foreground mb-3">
                  {t(`sections.${key}.title`)}
                </h2>
                <p className="text-muted text-[14px] leading-relaxed">
                  {t(`sections.${key}.content`)}
                </p>
              </section>
            ))}
          </div>

          {/* Footer */}
          <div className="pt-4 pb-8 flex flex-col items-center gap-6">
            <button
              onClick={() => router.push(`/${locale}`)}
              className="px-8 py-4 text-foreground label-text text-[13px] tracking-widest active:scale-[0.97] transition-all hover:text-accent"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border-subtle)",
                borderRadius: "14px",
              }}
            >
              {t("back")}
            </button>
            <p className="text-muted/60 text-[12px]">
              Throw To Win &mdash; Kosu.kuma.inc
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
