"use client";

import { useTranslations } from "next-intl";

type StatsDisplayProps = {
  worldRecord: number;
  todaysBest: number;
  totalThrows: number;
};

export function StatsDisplay({
  worldRecord,
  todaysBest,
  totalThrows,
}: StatsDisplayProps) {
  const t = useTranslations("landing");

  const rows = [
    {
      label: t("worldRecord"),
      value: `${worldRecord.toFixed(2)}m`,
    },
    {
      label: t("todaysBest"),
      value: `${todaysBest.toFixed(2)}m`,
    },
    {
      label: t("totalThrows"),
      value: totalThrows.toLocaleString(),
    },
  ];

  return (
    <div className="w-full max-w-xs flex flex-col">
      {rows.map((row, index) => (
        <div key={row.label}>
          <div className="flex items-center justify-between py-4">
            <span className="text-[#a3a3a3] text-sm uppercase tracking-widest font-medium">
              {row.label}
            </span>
            <span className="font-display font-black text-white text-2xl tabular-nums">
              {row.value}
            </span>
          </div>
          {index < rows.length - 1 && (
            <div className="w-full h-px bg-[#262626]" />
          )}
        </div>
      ))}
    </div>
  );
}
