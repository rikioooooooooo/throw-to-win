import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const [totalRow, pbRows] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) as total FROM devices").first<{ total: number }>(),
      env.DB.prepare("SELECT personal_best FROM devices WHERE personal_best > 0").all<{ personal_best: number }>(),
    ]);
    return NextResponse.json({
      totalUsers: totalRow?.total ?? 0,
      pbValues: (pbRows.results ?? []).map((r: { personal_best: number }) => r.personal_best),
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate", "CDN-Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
