"use client";

import { formatHeight } from "@/lib/physics";

/** Convert ISO 3166-1 alpha-2 country code to flag emoji (e.g. "JP" → "🇯🇵") */
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return code;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    upper.charCodeAt(0) + 0x1f1a5,
    upper.charCodeAt(1) + 0x1f1a5,
  );
}

export type RankEntry = {
  readonly rank: number;
  readonly deviceId: string;
  readonly displayName?: string;
  readonly heightMeters: number;
  readonly country: string;
};

type RankingListProps = {
  readonly title: string;
  readonly entries: readonly RankEntry[];
  readonly actionLabel?: string;
  readonly onAction?: () => void;
};

export function RankingList({
  title,
  entries,
  actionLabel,
  onAction,
}: RankingListProps) {
  return (
    <div className="mb-6">
      <h2 className="label-text text-[10px] tracking-[0.2em] text-muted/60 mb-3 uppercase">
        {title}
      </h2>
      <div
        className="overflow-hidden"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: "12px",
        }}
      >
        {entries.map((entry, i) => (
          <div
            key={`${entry.rank}-${entry.deviceId}`}
            className="flex items-center px-4 py-3"
            style={
              i < entries.length - 1 || actionLabel
                ? { borderBottom: "1px solid var(--color-border-subtle)" }
                : undefined
            }
          >
            <span
              className="height-number text-[14px] w-8 shrink-0"
              style={{
                color: entry.rank <= 3 ? "var(--color-accent-gold)" : "var(--color-muted)",
              }}
            >
              {entry.rank}
            </span>
            <span className="text-[12px] flex-1 truncate" style={{
              color: entry.displayName ? "var(--color-foreground)" : "var(--color-muted)",
              opacity: entry.displayName ? 0.7 : 0.5,
            }}>
              {entry.displayName || entry.deviceId}
            </span>
            <span className="text-[14px] mr-3" aria-label={entry.country}>
              {countryFlag(entry.country)}
            </span>
            <span className="height-number text-[16px] text-foreground">
              {formatHeight(entry.heightMeters)}
              <span className="text-[11px] text-muted ml-0.5">m</span>
            </span>
          </div>
        ))}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="w-full py-3 text-center text-muted text-[12px] tracking-[0.1em] hover:text-foreground transition-colors active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
