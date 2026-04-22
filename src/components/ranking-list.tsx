"use client";

import { formatHeight } from "@/lib/physics";
import { getTierForHeight } from "@/lib/tiers";
import { TierIcon } from "@/components/tier-icon";

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
  readonly isSelf?: boolean;
};

type RankingListProps = {
  readonly title: string;
  readonly entries: readonly RankEntry[];
  readonly actionLabel?: string;
  readonly onAction?: () => void;
};

function getRankColor(rank: number): string {
  if (rank === 1) return "var(--color-accent-gold)";
  if (rank === 2) return "var(--color-accent-silver)";
  if (rank === 3) return "var(--color-accent-bronze)";
  return "var(--color-muted)";
}

function getRankMedal(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

export function RankingList({
  title,
  entries,
  actionLabel,
  onAction,
}: RankingListProps) {
  return (
    <div className="mb-6">
      <h2 className="label-text text-[11px] tracking-[0.2em] text-muted/60 mb-3 uppercase">
        {title}
      </h2>
      <div className="game-card overflow-hidden">
        {entries.map((entry, i) => {
          const isTop3 = entry.rank <= 3;
          return (
            <div
              key={`${entry.rank}-${entry.deviceId}`}
              className="flex items-center px-4"
              style={{
                borderBottom: i < entries.length - 1 || actionLabel
                  ? "1px solid var(--color-border-game)"
                  : undefined,
                padding: isTop3 ? "14px 16px" : "10px 16px",
                borderLeft: entry.isSelf ? "3px solid var(--color-accent)" : undefined,
                background: entry.isSelf
                  ? (isTop3
                    ? `linear-gradient(90deg, ${getRankColor(entry.rank)}08, transparent 60%), rgba(0, 250, 154, 0.08)`
                    : "rgba(0, 250, 154, 0.08)")
                  : (isTop3
                    ? `linear-gradient(90deg, ${getRankColor(entry.rank)}08, transparent 60%)`
                    : undefined),
                animation: isTop3
                  ? `podium-enter 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${entry.rank * 80}ms both`
                  : undefined,
              }}
            >
              {/* Rank number or medal */}
              <span
                className={`height-number shrink-0 text-center ${isTop3 ? "text-[18px] font-bold" : "text-[14px]"}`}
                style={{
                  color: getRankColor(entry.rank),
                  width: isTop3 ? "36px" : "32px",
                }}
              >
                {isTop3 ? getRankMedal(entry.rank) : entry.rank}
              </span>
              <TierIcon tierId={getTierForHeight(entry.heightMeters).id} size={isTop3 ? 24 : 20} className="flex-shrink-0 mx-1" />
              <span className={`flex-1 truncate ${isTop3 ? "text-[13px] font-semibold" : "text-[12px]"} ${entry.isSelf && !isTop3 ? "font-semibold" : ""}`} style={{
                color: entry.displayName
                  ? isTop3 ? "var(--color-foreground)" : "rgba(237,237,237,0.7)"
                  : "var(--color-muted)",
              }}>
                {entry.displayName || entry.deviceId}
              </span>
              <span className="text-[14px] mr-3" aria-label={entry.country}>
                {countryFlag(entry.country)}
              </span>
              <span className={`height-number text-foreground ${isTop3 ? "text-[18px] font-semibold" : "text-[16px]"}`} style={{
                color: isTop3 ? getRankColor(entry.rank) : "var(--color-foreground)",
              }}>
                {formatHeight(entry.heightMeters)}
                <span className="text-[11px] text-muted ml-0.5">m</span>
              </span>
            </div>
          );
        })}
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="w-full py-3 text-center text-muted text-[12px] tracking-[0.1em] hover:text-accent transition-colors active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
