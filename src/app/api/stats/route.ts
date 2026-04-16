import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });

    const totalThrowsRow = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM throws",
    ).first<{ total: number }>();

    const totalDevicesRow = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM devices",
    ).first<{ total: number }>();

    const worldRecordRow = await env.DB.prepare(
      "SELECT MAX(height_meters) as record FROM throws WHERE anomaly_score < 0.9",
    ).first<{ record: number | null }>();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayThrowsRow = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM throws WHERE created_at >= ?",
    )
      .bind(todayStart.toISOString())
      .first<{ total: number }>();

    const countriesRow = await env.DB.prepare(
      "SELECT COUNT(DISTINCT country) as total FROM throws WHERE country != 'XX'",
    ).first<{ total: number }>();

    return NextResponse.json({
      totalThrows: totalThrowsRow?.total ?? 0,
      totalDevices: totalDevicesRow?.total ?? 0,
      worldRecord: worldRecordRow?.record ?? 0,
      todayThrows: todayThrowsRow?.total ?? 0,
      countriesActive: countriesRow?.total ?? 0,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
