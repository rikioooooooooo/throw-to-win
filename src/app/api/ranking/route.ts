import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type DeviceRankRow = {
  id: string;
  display_name: string;
  personal_best: number;
  total_throws: number;
  country: string;
  last_seen: string;
};

function anonymizeDeviceId(deviceId: string): string {
  return deviceId.slice(0, 8) + "****";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "world";
    const country = url.searchParams.get("country") ?? "";
    const period = url.searchParams.get("period") ?? "monthly";
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
    );
    const offset = Math.max(
      0,
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    );
    const selfFingerprint = url.searchParams.get("self") ?? "";

    const { env } = await getCloudflareContext({ async: true });

    let query: string;
    let params: unknown[];
    let countQuery: string;
    let countParams: unknown[];

    if (period === "alltime") {
      // All-time: query devices table directly (existing behavior)
      if (scope === "country" && country) {
        query =
          "SELECT id, display_name, personal_best, total_throws, country, last_seen FROM devices WHERE country = ? AND personal_best > 0 ORDER BY personal_best DESC LIMIT ? OFFSET ?";
        params = [country, limit, offset];
        countQuery = "SELECT COUNT(*) as total FROM devices WHERE country = ? AND personal_best > 0";
        countParams = [country];
      } else {
        query =
          "SELECT id, display_name, personal_best, total_throws, country, last_seen FROM devices WHERE personal_best > 0 ORDER BY personal_best DESC LIMIT ? OFFSET ?";
        params = [limit, offset];
        countQuery = "SELECT COUNT(*) as total FROM devices WHERE personal_best > 0";
        countParams = [];
      }
    } else {
      // Monthly: query throws table for this month's best per device
      if (scope === "country" && country) {
        query =
          "SELECT t.device_id as id, d.display_name, MAX(t.height_meters) as personal_best, COUNT(*) as total_throws, d.country, d.last_seen FROM throws t JOIN devices d ON t.device_id = d.id WHERE t.created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours') AND d.country = ? GROUP BY t.device_id ORDER BY personal_best DESC, t.device_id ASC LIMIT ? OFFSET ?";
        params = [country, limit, offset];
        countQuery = "SELECT COUNT(DISTINCT t.device_id) as total FROM throws t JOIN devices d ON t.device_id = d.id WHERE t.created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours') AND d.country = ?";
        countParams = [country];
      } else {
        query =
          "SELECT t.device_id as id, d.display_name, MAX(t.height_meters) as personal_best, COUNT(*) as total_throws, d.country, d.last_seen FROM throws t JOIN devices d ON t.device_id = d.id WHERE t.created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours') GROUP BY t.device_id ORDER BY personal_best DESC, t.device_id ASC LIMIT ? OFFSET ?";
        params = [limit, offset];
        countQuery = "SELECT COUNT(DISTINCT device_id) as total FROM throws WHERE created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours')";
        countParams = [];
      }
    }

    const stmt = env.DB.prepare(query);
    const bound =
      params.length === 3
        ? stmt.bind(params[0], params[1], params[2])
        : stmt.bind(params[0], params[1]);

    const countStmt = env.DB.prepare(countQuery);
    const countBound =
      countParams.length === 1
        ? countStmt.bind(countParams[0])
        : countStmt;

    // Run data + count queries in parallel
    const [result, countResult] = await Promise.all([
      bound.all<DeviceRankRow>(),
      countBound.first<{ total: number }>(),
    ]);

    const rows: DeviceRankRow[] = result.results ?? [];

    const rankings = rows.map((row, index) => ({
      rank: offset + index + 1,
      deviceId: anonymizeDeviceId(row.id),
      displayName: row.display_name || "",
      heightMeters: row.personal_best,
      totalThrows: row.total_throws,
      country: row.country,
      lastSeen: row.last_seen,
      ...(selfFingerprint ? { isSelf: row.id === selfFingerprint } : {}),
    }));

    const yourCountry = request.headers.get("cf-ipcountry") ?? "XX";

    // Self rank: if self fingerprint provided, get user's rank (period-aware)
    let selfRank: number | null = null;
    if (selfFingerprint) {
      if (period === "alltime") {
        const selfRankResult = await env.DB.prepare(
          "SELECT COUNT(*) + 1 as rank FROM devices WHERE personal_best > (SELECT COALESCE(personal_best, 0) FROM devices WHERE id = ?) AND personal_best > 0"
        ).bind(selfFingerprint).first<{ rank: number }>();
        const selfDevice = await env.DB.prepare(
          "SELECT personal_best FROM devices WHERE id = ? AND personal_best > 0"
        ).bind(selfFingerprint).first<{ personal_best: number }>();
        if (selfDevice && selfRankResult) {
          selfRank = selfRankResult.rank;
        }
      } else {
        // Monthly: rank based on this month's best throw per device
        const selfMonthlyBest = await env.DB.prepare(
          "SELECT MAX(height_meters) as best FROM throws WHERE device_id = ? AND created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours')"
        ).bind(selfFingerprint).first<{ best: number | null }>();
        if (selfMonthlyBest?.best && selfMonthlyBest.best > 0) {
          const selfRankResult = await env.DB.prepare(
            "SELECT COUNT(*) as rank FROM (SELECT device_id, MAX(height_meters) as best FROM throws WHERE created_at >= datetime('now', '+9 hours', 'start of month', '-9 hours') GROUP BY device_id HAVING best > ?)"
          ).bind(selfMonthlyBest.best).first<{ rank: number }>();
          selfRank = (selfRankResult?.rank ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({
      rankings,
      total: countResult?.total ?? 0,
      limit,
      offset,
      yourCountry,
      selfRank,
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
