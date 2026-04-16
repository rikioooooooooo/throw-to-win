import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

type ThrowRow = {
  id: string;
  height_meters: number;
  airtime_seconds: number;
  country: string;
  anomaly_score: number;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deviceId = url.searchParams.get("deviceId");

    if (!deviceId) {
      return NextResponse.json(
        { error: "Missing deviceId parameter" },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });

    const device = await env.DB.prepare(
      "SELECT id, total_throws, personal_best, country FROM devices WHERE id = ?",
    )
      .bind(deviceId)
      .first<{
        id: string;
        total_throws: number;
        personal_best: number;
        country: string;
      }>();

    if (!device) {
      return NextResponse.json({
        personalBest: 0,
        totalThrows: 0,
        worldRank: null,
        countryRank: null,
        recentThrows: [],
      });
    }

    const worldRankRow = await env.DB.prepare(
      "SELECT COUNT(*) as rank FROM devices WHERE personal_best > ?",
    )
      .bind(device.personal_best)
      .first<{ rank: number }>();

    const countryRankRow = await env.DB.prepare(
      "SELECT COUNT(*) as rank FROM devices WHERE personal_best > ? AND country = ?",
    )
      .bind(device.personal_best, device.country)
      .first<{ rank: number }>();

    const recentResult = await env.DB.prepare(
      "SELECT id, height_meters, airtime_seconds, country, anomaly_score, created_at FROM throws WHERE device_id = ? ORDER BY created_at DESC LIMIT 20",
    )
      .bind(deviceId)
      .all<ThrowRow>();
    const throwRows: ThrowRow[] = recentResult.results ?? [];

    const recentThrows = throwRows.map((row) => ({
      id: row.id,
      heightMeters: row.height_meters,
      airtimeSeconds: row.airtime_seconds,
      country: row.country,
      createdAt: row.created_at,
    }));

    return NextResponse.json({
      personalBest: device.personal_best,
      totalThrows: device.total_throws,
      worldRank: (worldRankRow?.rank ?? 0) + 1,
      countryRank: (countryRankRow?.rank ?? 0) + 1,
      recentThrows,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
