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
      <header className="px-6 py-5 border-b border-border flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-md z-10">
        <button
          onClick={() => router.push(`/${locale}`)}
          className="w-10 h-10 border border-border bg-surface flex items-center justify-center active:scale-[0.97] transition-transform"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display text-[20px] font-black tracking-widest uppercase">
          {t("heading")}
        </h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-10 animate-fade-in-up">
          {/* Last updated intro */}
          <div className="border-l-2 border-accent pl-4">
            <p className="font-display text-[12px] tracking-widest text-accent uppercase mb-1">
              {t("lastUpdated")}
            </p>
            <p className="text-muted text-[13px]">2024-01-01</p>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            {SECTIONS.map((key) => (
              <section
                key={key}
                className="border border-border bg-surface p-6"
              >
                <h2 className="font-display text-[16px] font-black tracking-widest uppercase text-white mb-3">
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
              className="px-8 py-4 bg-surface-light border border-border text-white font-display text-[13px] tracking-widest uppercase hover:bg-surface transition-colors active:scale-[0.97]"
            >
              {t("back")}
            </button>
            <p className="text-muted/60 text-[12px]">
              Throw To Win &mdash; Kosukuma Inc.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
