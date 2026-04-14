"use client";

import { useTranslations } from "next-intl";
import type { ThrowRecord } from "@/lib/types";

type ThrowHistoryProps = {
  throws: readonly ThrowRecord[];
  sortBy: "date" | "height";
  onSortChange: (sort: "date" | "height") => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ThrowHistory({
  throws,
  sortBy,
  onSortChange,
}: ThrowHistoryProps) {
  const t = useTranslations("mypage");

  const sorted = [...throws].sort((a, b) => {
    if (sortBy === "height") return b.heightMeters - a.heightMeters;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Sort toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => onSortChange("date")}
          className={[
            "flex-1 py-2 text-sm font-bold uppercase tracking-widest border transition-colors",
            sortBy === "date"
              ? "border-white text-white bg-transparent"
              : "border-[#262626] text-[#a3a3a3] hover:border-[#404040]",
          ].join(" ")}
        >
          {t("sortByDate")}
        </button>
        <button
          onClick={() => onSortChange("height")}
          className={[
            "flex-1 py-2 text-sm font-bold uppercase tracking-widest border transition-colors",
            sortBy === "height"
              ? "border-white text-white bg-transparent"
              : "border-[#262626] text-[#a3a3a3] hover:border-[#404040]",
          ].join(" ")}
        >
          {t("sortByHeight")}
        </button>
      </div>

      {/* List */}
      {sorted.length === 0 ? (
        <p className="text-[#a3a3a3] text-sm text-center py-12">
          {t("noThrows")}
        </p>
      ) : (
        <div className="flex flex-col">
          {sorted.map((record, index) => (
            <div key={record.id}>
              <div
                className={[
                  "flex items-center justify-between py-4",
                  record.isPersonalBest ? "relative" : "",
                ].join(" ")}
              >
                {record.isPersonalBest && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-yellow-400" />
                )}
                <div className="flex flex-col gap-0.5 pl-4">
                  <span
                    className={[
                      "font-display font-black text-2xl tabular-nums leading-none",
                      record.isPersonalBest ? "text-yellow-400" : "text-white",
                    ].join(" ")}
                  >
                    {record.heightMeters.toFixed(2)}
                    <span className="text-sm align-bottom ml-0.5">
                      {t("meters")}
                    </span>
                  </span>
                  <span className="text-[#a3a3a3] text-xs tabular-nums">
                    {record.airtimeSeconds.toFixed(2)}
                    {t("seconds")}
                  </span>
                </div>
                <span className="text-[#a3a3a3] text-xs text-right">
                  {formatDate(record.timestamp)}
                </span>
              </div>
              {index < sorted.length - 1 && (
                <div className="w-full h-px bg-[#262626]" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
