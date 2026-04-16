import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type DeviceRankRow = {
  id: string;
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
    const limit = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
    );
    const offset = Math.max(
      0,
      parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
    );

    const { env } = await getCloudflareContext({ async: true });

    let query: string;
    let params: unknown[];

    if (scope === "country" && country) {
      query =
        "SELECT id, personal_best, total_throws, country, last_seen FROM devices WHERE country = ? ORDER BY personal_best DESC LIMIT ? OFFSET ?";
      params = [country, limit, offset];
    } else {
      query =
        "SELECT id, personal_best, total_throws, country, last_seen FROM devices ORDER BY personal_best DESC LIMIT ? OFFSET ?";
      params = [limit, offset];
    }

    const stmt = env.DB.prepare(query);
    const bound =
      params.length === 3
        ? stmt.bind(params[0], params[1], params[2])
        : stmt.bind(params[0], params[1]);
    const result = await bound.all<DeviceRankRow>();
    const rows: DeviceRankRow[] = result.results ?? [];

    const rankings = rows.map((row, index) => ({
      rank: offset + index + 1,
      deviceId: anonymizeDeviceId(row.id),
      heightMeters: row.personal_best,
      totalThrows: row.total_throws,
      country: row.country,
      lastSeen: row.last_seen,
    }));

    const countQuery =
      scope === "country" && country
        ? "SELECT COUNT(*) as total FROM devices WHERE country = ?"
        : "SELECT COUNT(*) as total FROM devices";

    const countStmt = env.DB.prepare(countQuery);
    const countBound =
      scope === "country" && country
        ? countStmt.bind(country)
        : countStmt;
    const countResult = await countBound.first<{ total: number }>();

    return NextResponse.json({
      rankings,
      total: countResult?.total ?? 0,
      limit,
      offset,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
