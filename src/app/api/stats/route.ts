import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Run all queries in parallel
    const [totalThrowsRow, totalDevicesRow, worldRecordRow, todayThrowsRow, countriesRow] =
      await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as total FROM throws")
          .first<{ total: number }>(),
        env.DB.prepare("SELECT COUNT(*) as total FROM devices")
          .first<{ total: number }>(),
        env.DB.prepare("SELECT MAX(height_meters) as record FROM throws WHERE anomaly_score < 0.9")
          .first<{ record: number | null }>(),
        env.DB.prepare("SELECT COUNT(*) as total FROM throws WHERE created_at >= ?")
          .bind(todayStart.toISOString())
          .first<{ total: number }>(),
        env.DB.prepare("SELECT COUNT(DISTINCT country) as total FROM throws WHERE country != 'XX'")
          .first<{ total: number }>(),
      ]);

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
