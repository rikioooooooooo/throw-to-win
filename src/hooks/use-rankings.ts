"use client";

import { useState, useEffect } from "react";
import type { RankEntry } from "@/components/ranking-list";
import { generateFingerprint } from "@/lib/fingerprint";

type RankingsState = {
  readonly world: readonly RankEntry[];
  readonly country: readonly RankEntry[];
  readonly yourCountry: string;
  readonly loading: boolean;
  readonly selfRank: number | null;
};

/**
 * Shared hook for fetching world + country rankings.
 * Handles AbortController cleanup on unmount.
 */
export function useRankings(
  opts: { limit?: number; enabled?: boolean; period?: "monthly" | "alltime" } = {},
): RankingsState {
  const { limit = 10, enabled = true, period = "monthly" } = opts;
  const [state, setState] = useState<RankingsState>({
    world: [],
    country: [],
    yourCountry: "",
    loading: true,
    selfRank: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    async function fetchRankings() {
      try {
        const fingerprint = await generateFingerprint();
        const selfParam = `&self=${encodeURIComponent(fingerprint)}`;

        const worldRes = await fetch(
          `/api/ranking?scope=world&limit=${limit}&period=${period}${selfParam}&_t=${Date.now()}`,
          { signal, cache: "no-store" },
        );
        if (!worldRes.ok) return;

        const worldData = (await worldRes.json()) as {
          rankings: RankEntry[];
          yourCountry: string;
          selfRank: number | null;
        };
        if (signal.aborted) return;

        let countryRankings: RankEntry[] = [];
        if ((worldData.yourCountry ?? "") !== "" && worldData.yourCountry !== "XX") {
          const countryRes = await fetch(
            `/api/ranking?scope=country&country=${worldData.yourCountry}&limit=${limit}&period=${period}${selfParam}&_t=${Date.now()}`,
            { signal, cache: "no-store" },
          );
          if (countryRes.ok) {
            const countryData = (await countryRes.json()) as {
              rankings: RankEntry[];
            };
            countryRankings = countryData.rankings ?? [];
          }
        }

        if (!signal.aborted) {
          setState({
            world: worldData.rankings ?? [],
            country: countryRankings,
            yourCountry: worldData.yourCountry ?? "",
            loading: false,
            selfRank: worldData.selfRank ?? null,
          });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!signal.aborted) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchRankings();
    return () => controller.abort();
  }, [limit, enabled, period]);

  return state;
}
